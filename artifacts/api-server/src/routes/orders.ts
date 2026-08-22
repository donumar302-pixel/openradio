import { Router, type IRouter, type RequestHandler } from "express";
import multer from "multer";
import { db, ordersTable } from "@workspace/db";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { requireAuthenticatedUser, isUserAdmin } from "../middleware/require-active-user";
import {
  getPaymentMethods,
  publicPaymentMethod,
  type PaymentMethod,
} from "../lib/settings";
import {
  CURRENCIES,
  PLAN_DURATION_DAYS,
  planCredits,
  priceInCurrency,
  type PlanId,
} from "../lib/plans";

const router: IRouter = Router();

const PAID_PLANS = new Set<PlanId>(["starter", "pro", "max"]);
const SUPPORTED_CURRENCIES = new Set(CURRENCIES.map((c) => c.code));

// Proof upload: images only, memory storage, 3MB cap.
const MAX_PROOF_BYTES = 3 * 1024 * 1024;
const ALLOWED_PROOF_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_PROOF_MIME.has(file.mimetype)) cb(null, true);
    else cb(null, false);
  },
});

const receiveProof: RequestHandler = (req, res, next) => {
  upload.single("proof")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      res.status(400).json({
        error: err.code === "LIMIT_FILE_SIZE"
          ? "Proof must be no larger than 3MB."
          : "Could not process the proof image.",
      });
      return;
    }
    if (err) {
      req.log?.error({ err }, "Proof upload failed");
      res.status(400).json({ error: "Could not process the proof image." });
      return;
    }
    next();
  });
};

function hasValidImageSignature(data: Buffer, mime: string): boolean {
  if (mime === "image/jpeg") {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (mime === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return data.length >= signature.length && signature.every((byte, index) => data[index] === byte);
  }
  if (mime === "image/webp") {
    return data.length >= 12
      && data.subarray(0, 4).toString("ascii") === "RIFF"
      && data.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

function isPaidPlan(v: unknown): v is PlanId {
  return typeof v === "string" && PAID_PLANS.has(v as PlanId);
}

// Currency prices may carry decimals (USD/EUR); store as integer minor units.
function amountMinor(plan: PlanId, currency: string): number {
  const price = priceInCurrency(plan, currency);
  return Math.round(price * 100);
}

/* ── GET /payment-methods — public, enabled methods only ─────────────── */
router.get("/payment-methods", async (_req, res) => {
  const methods = await getPaymentMethods();
  res.json({
    methods: methods.filter((m) => m.enabled).map(publicPaymentMethod),
  });
});

/* Everything below requires an active, authenticated user. */
// Renewal checkout must remain available to expired users. Blocked accounts
// still cannot submit because requireAuthenticatedUser enforces that status.
router.use(requireAuthenticatedUser);

/* ── GET /api/orders — current user's orders (no proof bytes) ────────── */
router.get("/", async (req, res) => {
  const user = req.appUser!;
  const rows = await db.select({
    id: ordersTable.id,
    plan: ordersTable.plan,
    status: ordersTable.status,
    adminNote: ordersTable.adminNote,
    planCredits: ordersTable.planCredits,
    durationDays: ordersTable.durationDays,
    currency: ordersTable.currency,
    amountMinor: ordersTable.amountMinor,
    paymentMethodId: ordersTable.paymentMethodId,
    paymentMethodSnapshot: ordersTable.paymentMethodSnapshot,
    customerName: ordersTable.customerName,
    customerEmail: ordersTable.customerEmail,
    whatsapp: ordersTable.whatsapp,
    transactionReference: ordersTable.transactionReference,
    proofMime: ordersTable.proofMime,
    proofFilename: ordersTable.proofFilename,
    proofSize: ordersTable.proofSize,
    reviewedAt: ordersTable.reviewedAt,
    createdAt: ordersTable.createdAt,
    updatedAt: ordersTable.updatedAt,
  })
    .from(ordersTable)
    .where(eq(ordersTable.userId, user.id))
    .orderBy(desc(ordersTable.createdAt));

  res.json(rows.map((o) => ({
    ...o,
    hasProof: o.proofSize != null && o.proofSize > 0,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    reviewedAt: o.reviewedAt?.toISOString() ?? null,
  })));
});

/* ── POST /api/orders — submit a plan payment with proof ─────────────── */
router.post("/", receiveProof, async (req, res) => {
  const user = req.appUser!;
  const b = (req.body ?? {}) as Record<string, unknown>;

  const plan = typeof b.plan === "string" ? b.plan : "";
  const currency = typeof b.currency === "string" ? b.currency.toUpperCase() : "";
  const paymentMethodId = typeof b.paymentMethodId === "string" ? b.paymentMethodId : "";
  const customerName = typeof b.customerName === "string" ? b.customerName.trim() : "";
  const whatsapp = typeof b.whatsapp === "string" ? b.whatsapp.trim() : "";
  const transactionReference = typeof b.transactionReference === "string" ? b.transactionReference.trim() : "";
  const termsAccepted = b.termsAccepted === "true" || b.termsAccepted === true;

  // ── Validation ──
  if (!isPaidPlan(plan)) { res.status(400).json({ error: "Please choose a valid plan." }); return; }
  if (!SUPPORTED_CURRENCIES.has(currency)) { res.status(400).json({ error: "Unsupported currency." }); return; }
  if (!termsAccepted) { res.status(400).json({ error: "You must accept the terms to continue." }); return; }
  if (!customerName || customerName.length > 200) { res.status(400).json({ error: "Please provide your name." }); return; }
  if (!whatsapp || whatsapp.length > 40) { res.status(400).json({ error: "Please provide a valid WhatsApp number." }); return; }
  if (!transactionReference || transactionReference.length > 200) {
    res.status(400).json({ error: "Please provide a valid transaction reference." });
    return;
  }
  if (!req.file) { res.status(400).json({ error: "Please attach a payment proof image (JPEG, PNG, or WebP, up to 3MB)." }); return; }
  if (!ALLOWED_PROOF_MIME.has(req.file.mimetype)
      || req.file.size > MAX_PROOF_BYTES
      || !hasValidImageSignature(req.file.buffer, req.file.mimetype)) {
    res.status(400).json({ error: "Proof must be a JPEG, PNG, or WebP image up to 3MB." });
    return;
  }

  const methods = await getPaymentMethods();
  const method = methods.find((m: PaymentMethod) => m.id === paymentMethodId && m.enabled);
  if (!method) { res.status(400).json({ error: "Please choose a valid payment method." }); return; }

  // ── Server-derived commercial terms ──
  const credits = planCredits(plan);
  const amount = amountMinor(plan, currency);
  const snapshot = publicPaymentMethod(method);

  // Prevent a duplicate pending order for the same plan (DB-enforced too).
  const [existingPending] = await db.select({ id: ordersTable.id })
    .from(ordersTable)
    .where(and(
      eq(ordersTable.userId, user.id),
      eq(ordersTable.plan, plan),
       eq(ordersTable.status, "pending"),
       isNotNull(ordersTable.paymentMethodId),
    ));
  if (existingPending) {
    res.status(409).json({ error: "You already have a pending order for this plan." });
    return;
  }

  try {
    const [order] = await db.insert(ordersTable).values({
      userId: user.id,
      plan,
      status: "pending",
      planCredits: credits,
      durationDays: PLAN_DURATION_DAYS,
      currency,
      amountMinor: amount,
      paymentMethodId: method.id,
      paymentMethodSnapshot: snapshot,
      customerName,
      customerEmail: user.email,
      whatsapp,
      transactionReference,
      proofData: req.file.buffer,
      proofMime: req.file.mimetype,
      proofFilename: req.file.originalname?.slice(0, 255) || "proof",
      proofSize: req.file.size,
    }).returning({
      id: ordersTable.id,
      plan: ordersTable.plan,
      status: ordersTable.status,
      currency: ordersTable.currency,
      amountMinor: ordersTable.amountMinor,
      createdAt: ordersTable.createdAt,
    });

    res.status(201).json({
      ...order,
      hasProof: true,
      createdAt: order.createdAt.toISOString(),
    });
  } catch (err) {
    // The partial unique index may reject a racing duplicate pending order.
    const msg = err instanceof Error ? err.message : "";
    if (/orders_user_plan_pending_idx|duplicate key/i.test(msg)) {
      res.status(409).json({ error: "You already have a pending order for this plan." });
      return;
    }
    req.log.error({ err }, "Failed to create order");
    res.status(500).json({ error: "Could not submit your order. Please try again." });
  }
});

/* ── GET /api/orders/:id/proof — inline image, owner or admin only ───── */
router.get("/:id/proof", async (req, res) => {
  const user = req.appUser!;
  const id = parseInt(String(req.params.id), 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [order] = await db.select({
    userId: ordersTable.userId,
    proofData: ordersTable.proofData,
    proofMime: ordersTable.proofMime,
    proofFilename: ordersTable.proofFilename,
  }).from(ordersTable).where(eq(ordersTable.id, id));

  if (!order) { res.status(404).json({ error: "Order not found" }); return; }
  if (order.userId !== user.id && !isUserAdmin(user)) {
    res.status(403).json({ error: "You do not have access to this proof." });
    return;
  }
  if (!order.proofData || !order.proofMime) { res.status(404).json({ error: "No proof on file." }); return; }

  res.setHeader("Content-Type", order.proofMime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  const safeName = (order.proofFilename ?? "proof").replace(/["\r\n]/g, "");
  res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
  res.send(Buffer.from(order.proofData));
});

export default router;
