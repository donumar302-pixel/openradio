import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const apiKeysTable = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  key: text("key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({ id: true, usageCount: true, lastUsedAt: true, createdAt: true });
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type ApiKeyRecord = typeof apiKeysTable.$inferSelect;

export const generationsTable = pgTable("generations", {
  id: serial("id").primaryKey(),
  text: text("text").notNull(),
  voiceId: text("voice_id").notNull(),
  voiceName: text("voice_name").notNull(),
  characterCount: integer("character_count").notNull(),
  audioUrl: text("audio_url").notNull(),
  modelId: text("model_id"),
  apiKeyId: integer("api_key_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGenerationSchema = createInsertSchema(generationsTable).omit({ id: true, createdAt: true });
export type InsertGeneration = z.infer<typeof insertGenerationSchema>;
export type Generation = typeof generationsTable.$inferSelect;
