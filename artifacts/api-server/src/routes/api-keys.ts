import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, userApiKeysTable } from "@workspace/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { requireActiveUser, isUserAdmin } from "../middleware/require-active-user";

/**
 * Session-authenticated management of the user's Developer API keys.
 * Full keys are shown exactly once at creation; only a sha256 hash is stored.
 */

const router: IRouter = Router();
router.use(requireActiveUser);

const MAX_KEYS = 5;

function requirePaidPlan(req: any, res: any, next: any) {
  const user = req.appUser!;
  if (!isUserAdmin(user) && user.plan === "free") {
    res.status(403).json({ error: "The Developer API is available on paid plans. Please upgrade to use it." });
    return;
  }
  next();
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}

function keyRowJson(k: typeof userApiKeysTable.$inferSelect) {
  return {
    id: k.id,
    name: k.name,
    keyPrefix: k.keyPrefix,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const rows = await db.select().from(userApiKeysTable)
    .where(and(eq(userApiKeysTable.userId, req.appUser!.id), isNull(userApiKeysTable.revokedAt)))
    .orderBy(desc(userApiKeysTable.createdAt));
  res.json({ keys: rows.map(keyRowJson) });
});

router.post("/", requirePaidPlan, async (req, res) => {
  const name = String(req.body?.name ?? "API Key").trim().slice(0, 60) || "API Key";
  const existing = await db.select({ id: userApiKeysTable.id }).from(userApiKeysTable)
    .where(and(eq(userApiKeysTable.userId, req.appUser!.id), isNull(userApiKeysTable.revokedAt)));
  if (existing.length >= MAX_KEYS) {
    res.status(400).json({ error: `You can have at most ${MAX_KEYS} active API keys. Revoke one first.` });
    return;
  }
  const fullKey = `orv_${crypto.randomBytes(24).toString("hex")}`;
  const [row] = await db.insert(userApiKeysTable).values({
    userId: req.appUser!.id,
    name,
    keyHash: hashApiKey(fullKey),
    keyPrefix: fullKey.slice(0, 12),
  }).returning();
  // The full key is returned exactly once and never stored in plaintext.
  res.status(201).json({ key: keyRowJson(row), fullKey });
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(String(req.params.id));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db.update(userApiKeysTable)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(userApiKeysTable.id, id),
      eq(userApiKeysTable.userId, req.appUser!.id),
      isNull(userApiKeysTable.revokedAt),
    )).returning({ id: userApiKeysTable.id });
  if (rows.length === 0) { res.status(404).json({ error: "Key not found" }); return; }
  res.status(204).send();
});

export default router;
