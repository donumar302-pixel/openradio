import { Router, type IRouter } from "express";
import { db, usersTable, promoCodesTable, promoRedemptionsTable, notificationsTable, supportTicketsTable, supportMessagesTable } from "@workspace/db";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { requireActiveUser } from "../middleware/require-active-user";
import { getSetting, type BannerSetting, type FeatureSwitches } from "../lib/settings";

const router: IRouter = Router();

/* ── Public settings (banner + killed features) ──────────────────────── */
router.get("/settings/public", async (_req, res) => {
  const [banner, features] = await Promise.all([
    getSetting<BannerSetting>("banner"),
    getSetting<FeatureSwitches>("features"),
  ]);
  const disabledFeatures = Object.entries(features).filter(([, v]) => v === false).map(([k]) => k);
  res.json({ banner, disabledFeatures });
});

/* ── Promo code redemption ───────────────────────────────────────────── */
router.post("/promo/redeem", requireActiveUser, async (req, res) => {
  const user = req.appUser!;
  const code = String(req.body?.code ?? "").trim().toUpperCase();
  if (!code) { res.status(400).json({ error: "Promo code required" }); return; }

  const [promo] = await db.select().from(promoCodesTable)
    .where(eq(promoCodesTable.code, code));

  if (!promo || !promo.isActive) { res.status(404).json({ error: "Invalid promo code" }); return; }
  if (promo.expiresAt && promo.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "This promo code has expired" }); return;
  }
  if (promo.maxRedemptions != null && promo.redemptionCount >= promo.maxRedemptions) {
    res.status(400).json({ error: "This promo code has reached its limit" }); return;
  }

  // Unique index (code_id, user_id) guarantees one redemption per user.
  try {
    await db.insert(promoRedemptionsTable).values({ codeId: promo.id, userId: user.id });
  } catch {
    res.status(400).json({ error: "You have already used this promo code" }); return;
  }

  await db.update(promoCodesTable)
    .set({ redemptionCount: sql`${promoCodesTable.redemptionCount} + 1` })
    .where(eq(promoCodesTable.id, promo.id));
  const [updated] = await db.update(usersTable)
    .set({ credits: sql`${usersTable.credits} + ${promo.credits}` })
    .where(eq(usersTable.id, user.id)).returning({ credits: usersTable.credits });

  res.json({ ok: true, creditsAdded: promo.credits, credits: updated.credits });
});

/* ── Notifications ───────────────────────────────────────────────────── */
router.get("/notifications", requireActiveUser, async (req, res) => {
  const user = req.appUser!;
  const rows = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt)).limit(50);
  const [unread] = await db.select({ n: sql<number>`count(*)` }).from(notificationsTable)
    .where(and(eq(notificationsTable.userId, user.id), isNull(notificationsTable.readAt)));
  res.json({
    unread: Number(unread.n),
    notifications: rows.map((n) => ({
      id: n.id, title: n.title, body: n.body,
      read: n.readAt != null, createdAt: n.createdAt.toISOString(),
    })),
  });
});

router.post("/notifications/read-all", requireActiveUser, async (req, res) => {
  await db.update(notificationsTable).set({ readAt: new Date() })
    .where(and(eq(notificationsTable.userId, req.appUser!.id), isNull(notificationsTable.readAt)));
  res.json({ ok: true });
});

/* ── Support tickets (user side) ─────────────────────────────────────── */
router.get("/support", requireActiveUser, async (req, res) => {
  const tickets = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, req.appUser!.id))
    .orderBy(desc(supportTicketsTable.updatedAt));
  res.json(tickets.map(serializeTicket));
});

router.post("/support", requireActiveUser, async (req, res) => {
  const subject = String(req.body?.subject ?? "").trim().slice(0, 200);
  const message = String(req.body?.message ?? "").trim().slice(0, 5000);
  if (!subject || !message) { res.status(400).json({ error: "Subject and message required" }); return; }
  const [ticket] = await db.insert(supportTicketsTable)
    .values({ userId: req.appUser!.id, subject }).returning();
  await db.insert(supportMessagesTable).values({ ticketId: ticket.id, sender: "user", body: message });
  res.status(201).json(serializeTicket(ticket));
});

router.get("/support/:id", requireActiveUser, async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [ticket] = await db.select().from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, req.appUser!.id)));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  const messages = await db.select().from(supportMessagesTable)
    .where(eq(supportMessagesTable.ticketId, id)).orderBy(supportMessagesTable.createdAt);
  res.json({ ...serializeTicket(ticket), messages: messages.map(serializeMessage) });
});

router.post("/support/:id/reply", requireActiveUser, async (req, res) => {
  const id = parseInt(String(req.params.id));
  const body = String(req.body?.message ?? "").trim().slice(0, 5000);
  if (isNaN(id) || !body) { res.status(400).json({ error: "Message required" }); return; }
  const [ticket] = await db.select().from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.id, id), eq(supportTicketsTable.userId, req.appUser!.id)));
  if (!ticket) { res.status(404).json({ error: "Ticket not found" }); return; }
  await db.insert(supportMessagesTable).values({ ticketId: id, sender: "user", body });
  await db.update(supportTicketsTable).set({ status: "open", updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));
  res.status(201).json({ ok: true });
});

function serializeTicket(t: typeof supportTicketsTable.$inferSelect) {
  return {
    id: t.id, subject: t.subject, status: t.status,
    createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
  };
}
function serializeMessage(m: typeof supportMessagesTable.$inferSelect) {
  return { id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt.toISOString() };
}

export default router;
