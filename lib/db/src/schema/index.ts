import { pgTable, serial, text, boolean, integer, timestamp, uniqueIndex, varchar, json, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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

export const voiceClonesTable = pgTable("voice_clones", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  name: text("name").notNull(),
  voiceId: text("voice_id").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Order = typeof ordersTable.$inferSelect;
