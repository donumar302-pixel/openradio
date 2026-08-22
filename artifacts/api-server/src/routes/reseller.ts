import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { and, eq, sql, count, desc, gte } from "drizzle-orm";
import { requireReseller } from "../middleware/require-reseller";
import { isAdminEmail } from "../lib/admin";

const router = Router();
router.use(requireReseller);

/* ── GET /me — reseller dashboard stats ── */
router.get("/me", async (req, res) => {
  const r = req.resellerUser!;
  const [{ n: userCount }] = await db.select({ n: count() }).from(usersTable)
    .where(eq(usersTable.resellerId, r.id));
  const [{ given }] = await db.select({ given: sql<number>`COALESCE(SUM(credits + credits_used), 0)` })
    .from(usersTable).where(eq(usersTable.resellerId, r.id));
  res.json({
    name: r.name,
    email: r.email,
    credits: r.resellerCredits,
    expiresAt: r.resellerExpiresAt?.toISOString() ?? null,
    userCount,
    creditsGiven: Number(given),
  });
});

/* ── GET /users — only this reseller's users ── */
router.get("/users", async (req, res) => {
  const r = req.resellerUser!;
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    credits: usersTable.credits,
    creditsUsed: usersTable.creditsUsed,
    status: usersTable.status,
    expiresAt: usersTable.planExpiresAt,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.resellerId, r.id)).orderBy(desc(usersTable.createdAt));
  res.json(users);
});

/* ── POST /users — create a user, credits deducted from reseller pool ── */
router.post("/users", async (req, res) => {
  const r = req.resellerUser!;
  const name = String(req.body?.name ?? "").trim();
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const credits = Number(req.body?.credits);

  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) { res.status(400).json({ error: "Valid name and email required" }); return; }
  if (isAdminEmail(email)) { res.status(400).json({ error: "This email is not allowed" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "Password must be at least 6 characters" }); return; }
  if (!Number.isFinite(credits) || credits <= 0 || !Number.isInteger(credits)) {
    res.status(400).json({ error: "Credits must be a positive whole number" }); return;
  }
  if (credits > r.resellerCredits) {
    res.status(400).json({ error: `Not enough credits. You have ${r.resellerCredits.toLocaleString()} left.` }); return;
  }

  const expiresAt = parseUserExpiry(req.body?.expiresAt, res);
  if (expiresAt === undefined) return; // response already sent

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const result = await db.transaction(async (tx) => {
      // Conditional decrement enforces the pool under concurrency.
      const deducted = await tx.update(usersTable)
        .set({ resellerCredits: sql`${usersTable.resellerCredits} - ${credits}` })
        .where(and(eq(usersTable.id, r.id), gte(usersTable.resellerCredits, credits)))
        .returning({ left: usersTable.resellerCredits });
      if (deducted.length === 0) return { insufficient: true as const };
      const [user] = await tx.insert(usersTable).values({
        name, email, passwordHash, credits,
        plan: "pro",
        planExpiresAt: expiresAt,
        resellerId: r.id,
        signupIp: req.ip ?? null,
      }).returning();
      return { user, left: deducted[0].left };
    });
    if ("insufficient" in result) { res.status(400).json({ error: "Not enough credits" }); return; }
    res.status(201).json({
      id: result.user.id, name: result.user.name, email: result.user.email,
      credits: result.user.credits, resellerCreditsLeft: result.left,
    });
  } catch (e: any) {
    if (String(e?.cause?.message ?? e?.message ?? "").includes("users_email_idx") || e?.code === "23505" || e?.cause?.code === "23505") {
      res.status(400).json({ error: "This email is already registered" }); return;
    }
    throw e;
  }
});

/* Max 31 days ahead ("1 month or less"). Returns Date, null (no expiry not
   allowed → defaults handled by caller), or undefined when a 400 was sent. */
function parseUserExpiry(raw: unknown, res: import("express").Response): Date | null | undefined {
  if (raw === undefined || raw === null || raw === "") return null;
  const d = new Date(String(raw));
  if (isNaN(d.getTime())) { res.status(400).json({ error: "Invalid expiry date" }); return undefined; }
  const now = Date.now();
  if (d.getTime() <= now) { res.status(400).json({ error: "Expiry must be in the future" }); return undefined; }
  const maxMs = now + 31 * 24 * 60 * 60 * 1000;
  if (d.getTime() > maxMs) { res.status(400).json({ error: "Expiry can be at most 1 month from today" }); return undefined; }
  return d;
}

/* ── PATCH /users/:id — suspend / unsuspend / change expiry of own user ── */
router.patch("/users/:id", async (req, res) => {
  const r = req.resellerUser!;
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid request" }); return; }

  const updates: Record<string, unknown> = {};
  if (req.body?.status !== undefined) {
    const status = String(req.body.status);
    if (status !== "active" && status !== "blocked") { res.status(400).json({ error: "Invalid status" }); return; }
    updates.status = status;
  }
  if ("expiresAt" in (req.body ?? {})) {
    const expiresAt = parseUserExpiry(req.body.expiresAt, res);
    if (expiresAt === undefined) return;
    updates.planExpiresAt = expiresAt;
  }
  if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

  const updated = await db.update(usersTable).set(updates)
    .where(and(eq(usersTable.id, id), eq(usersTable.resellerId, r.id), eq(usersTable.isAdmin, false)))
    .returning({ id: usersTable.id });
  if (updated.length === 0) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ok: true });
});

/* ── POST /users/:id/credits — give more credits to own user (from pool) ── */
router.post("/users/:id/credits", async (req, res) => {
  const r = req.resellerUser!;
  const id = parseInt(String(req.params.id));
  const credits = Number(req.body?.credits);
  if (isNaN(id) || !Number.isFinite(credits) || credits <= 0 || !Number.isInteger(credits)) {
    res.status(400).json({ error: "Credits must be a positive whole number" }); return;
  }
  const result = await db.transaction(async (tx) => {
    const deducted = await tx.update(usersTable)
      .set({ resellerCredits: sql`${usersTable.resellerCredits} - ${credits}` })
      .where(and(eq(usersTable.id, r.id), gte(usersTable.resellerCredits, credits)))
      .returning({ left: usersTable.resellerCredits });
    if (deducted.length === 0) return { insufficient: true as const };
    const updated = await tx.update(usersTable)
      .set({ credits: sql`${usersTable.credits} + ${credits}` })
      .where(and(eq(usersTable.id, id), eq(usersTable.resellerId, r.id)))
      .returning({ credits: usersTable.credits });
    if (updated.length === 0) throw Object.assign(new Error("not found"), { notFound: true });
    return { credits: updated[0].credits, left: deducted[0].left };
  }).catch((e) => {
    if (e?.notFound) return { notFound: true as const };
    throw e;
  });
  if ("insufficient" in result) { res.status(400).json({ error: "Not enough credits in your pool" }); return; }
  if ("notFound" in result) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ ok: true, userCredits: result.credits, resellerCreditsLeft: result.left });
});

/* ── DELETE /users/:id — delete own user ── */
router.delete("/users/:id", async (req, res) => {
  const r = req.resellerUser!;
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const deleted = await db.delete(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.resellerId, r.id), eq(usersTable.isAdmin, false)))
    .returning({ id: usersTable.id });
  if (deleted.length === 0) { res.status(404).json({ error: "User not found" }); return; }
  res.status(204).send();
});

export default router;
