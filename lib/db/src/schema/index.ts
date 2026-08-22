import { pgTable, serial, text, boolean, integer, timestamp, uniqueIndex, varchar, json, index, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Postgres `bytea` column mapped to a Node Buffer. drizzle has no first-class
 * bytea type, so define it once here for binary blobs (e.g. payment proof).
 */
export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

// Session store table for connect-pg-simple. Managed here (instead of the
// library's createTableIfMissing) because the bundled server cannot resolve
// the library's table.sql, so the table must be created via `db push`.
export const userSessionsTable = pgTable("user_sessions", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (t) => [index("IDX_user_sessions_expire").on(t.expire)]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  plan: text("plan").notNull().default("free"),
  credits: integer("credits").notNull().default(0),
  creditsUsed: integer("credits_used").notNull().default(0),
  planExpiresAt: timestamp("plan_expires_at"),
  status: text("status").notNull().default("active"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isReseller: boolean("is_reseller").notNull().default(false),
  resellerCredits: integer("reseller_credits").notNull().default(0),
  resellerExpiresAt: timestamp("reseller_expires_at"),
  resellerId: integer("reseller_id"), // set on users created by a reseller
  signupIp: text("signup_ip"),
  // Set to the planExpiresAt value we last emailed a reminder about, so each
  // new expiry date triggers exactly one reminder email.
  expiryNotifiedAt: timestamp("expiry_notified_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("users_email_idx").on(t.email)]);

export type User = typeof usersTable.$inferSelect;

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  key: text("key").notNull(),
  provider: text("provider").notNull().default("elevenlabs"),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  creditLimit: integer("credit_limit"),
  creditsUsed: integer("credits_used").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ── User-facing Developer API keys (hashed; full key shown once) ────── */
export const userApiKeysTable = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull().default("API Key"),
  keyHash: text("key_hash").notNull(),   // sha256 hex of the full key
  keyPrefix: text("key_prefix").notNull(), // first chars, for display only
  lastUsedAt: timestamp("last_used_at"),
  revokedAt: timestamp("revoked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("user_api_keys_user_idx").on(t.userId), uniqueIndex("user_api_keys_hash_idx").on(t.keyHash)]);

export type UserApiKey = typeof userApiKeysTable.$inferSelect;

export const voiceClonesTable = pgTable("voice_clones", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  voiceId: text("voice_id").notNull(),
  description: text("description"),
  provider: text("provider").notNull().default("minimax"), // "minimax" | "openspeaker"
  consentAt: timestamp("consent_at"),          // when the user attested consent
  consentText: text("consent_text"),           // the exact attestation text (versioned)
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ── OpenSpeaker async tool tasks (user-owned) ───────────────────────── */
export const osTasksTable = pgTable("os_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  tool: text("tool").notNull(), // tts | dialogue | dubbing | voice-changer | voice-isolation | speech-to-text | sound-effects | music | image
  externalTaskId: text("external_task_id"),
  status: text("status").notNull().default("processing"), // processing | done | error
  title: text("title").notNull().default(""),
  input: json("input"),
  output: json("output"),
  error: text("error"),
  creditsCharged: integer("credits_charged").notNull().default(0),
  refunded: boolean("refunded").notNull().default(false),
  webhookToken: text("webhook_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("os_tasks_user_idx").on(t.userId), index("os_tasks_external_idx").on(t.externalTaskId)]);

export type OsTask = typeof osTasksTable.$inferSelect;

/* ── OpenSpeaker pronunciation dictionaries (ownership mapping) ──────── */
export const osDictionariesTable = pgTable("os_dictionaries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  externalId: text("external_id").notNull(),
  name: text("name").notNull(),
  rulesCount: integer("rules_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("os_dictionaries_user_idx").on(t.userId), uniqueIndex("os_dictionaries_external_idx").on(t.externalId)]);

export type OsDictionary = typeof osDictionariesTable.$inferSelect;

export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({ id: true, usageCount: true, creditsUsed: true, lastUsedAt: true, createdAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKeyRecord = typeof apiKeysTable.$inferSelect;

export const generationsTable = pgTable("generations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  text: text("text").notNull(),
  voiceId: text("voice_id").notNull(),
  voiceName: text("voice_name").notNull(),
  characterCount: integer("character_count").notNull(),
  audioUrl: text("audio_url").notNull(),
  modelId: text("model_id"),
  provider: text("provider").notNull().default("elevenlabs"),
  apiKeyId: integer("api_key_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ id: true, createdAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  plan: text("plan").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  adminNote: text("admin_note"),
  // ── Purchase snapshot (nullable for legacy admin-created rows) ──────────
  planCredits: integer("plan_credits"),
  durationDays: integer("duration_days"),
  currency: text("currency"),
  amountMinor: integer("amount_minor"),
  paymentMethodId: text("payment_method_id"),
  paymentMethodSnapshot: json("payment_method_snapshot"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  whatsapp: text("whatsapp"),
  transactionReference: text("transaction_reference"),
  // ── Proof of payment (bytea + metadata) ─────────────────────────────────
  proofData: bytea("proof_data"),
  proofMime: text("proof_mime"),
  proofFilename: text("proof_filename"),
  proofSize: integer("proof_size"),
  // ── Review audit ────────────────────────────────────────────────────────
  reviewedBy: integer("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("orders_user_idx").on(t.userId),
  index("orders_status_idx").on(t.status),
  // Enforce at most one pending order per (user, plan) at the DB level.
  uniqueIndex("orders_user_plan_pending_v2_idx")
    .on(t.userId, t.plan)
    .where(sql`${t.status} = 'pending' AND ${t.paymentMethodId} IS NOT NULL`),
]);

export type Order = typeof ordersTable.$inferSelect;

/* ── Promo codes ─────────────────────────────────────────────────────── */
export const promoCodesTable = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  credits: integer("credits").notNull().default(0),
  maxRedemptions: integer("max_redemptions"),
  redemptionCount: integer("redemption_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("promo_codes_code_idx").on(t.code)]);

export type PromoCode = typeof promoCodesTable.$inferSelect;

export const promoRedemptionsTable = pgTable("promo_redemptions", {
  id: serial("id").primaryKey(),
  codeId: integer("code_id").notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("promo_redemptions_code_user_idx").on(t.codeId, t.userId)]);

/* ── Notifications (fanned out per user) ─────────────────────────────── */
export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("notifications_user_idx").on(t.userId)]);

export type Notification = typeof notificationsTable.$inferSelect;

/* ── Support tickets ─────────────────────────────────────────────────── */
export const supportTicketsTable = pgTable("support_tickets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"), // open | answered | closed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("support_tickets_user_idx").on(t.userId)]);

export type SupportTicket = typeof supportTicketsTable.$inferSelect;

export const supportMessagesTable = pgTable("support_messages", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull(),
  sender: text("sender").notNull(), // "user" | "admin"
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [index("support_messages_ticket_idx").on(t.ticketId)]);

export type SupportMessage = typeof supportMessagesTable.$inferSelect;

/* ── ElevenLabs crawled voice index snapshot (voice_id → raw voice JSON).
   Persists the in-memory Voice Library index across API-server restarts so
   the full catalog is available immediately at boot. ─────────────────── */
export const elVoiceIndexTable = pgTable("el_voice_index", {
  voiceId: text("voice_id").primaryKey(),
  data: json("data").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ── Platform settings (key/value, JSON string values) ───────────────── */
export const appSettingsTable = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
