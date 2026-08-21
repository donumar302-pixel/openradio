import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Idempotent startup migration. Railway deploys never run `drizzle push`,
 * so any additive schema change must be mirrored here as IF NOT EXISTS SQL.
 */
export async function ensureSchema(): Promise<void> {
  const statements = [
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_ip text`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_reseller boolean NOT NULL DEFAULT false`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reseller_credits integer NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reseller_expires_at timestamp`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS reseller_id integer`,
    `CREATE TABLE IF NOT EXISTS promo_codes (
      id serial PRIMARY KEY,
      code text NOT NULL,
      credits integer NOT NULL DEFAULT 0,
      max_redemptions integer,
      redemption_count integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      expires_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS promo_codes_code_idx ON promo_codes (code)`,
    `CREATE TABLE IF NOT EXISTS promo_redemptions (
      id serial PRIMARY KEY,
      code_id integer NOT NULL,
      user_id integer NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS promo_redemptions_code_user_idx ON promo_redemptions (code_id, user_id)`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      title text NOT NULL,
      body text NOT NULL DEFAULT '',
      read_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id)`,
    `CREATE TABLE IF NOT EXISTS support_tickets (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      subject text NOT NULL,
      status text NOT NULL DEFAULT 'open',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS support_tickets_user_idx ON support_tickets (user_id)`,
    `CREATE TABLE IF NOT EXISTS support_messages (
      id serial PRIMARY KEY,
      ticket_id integer NOT NULL,
      sender text NOT NULL,
      body text NOT NULL,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages (ticket_id)`,
    `CREATE TABLE IF NOT EXISTS app_settings (
      key text PRIMARY KEY,
      value text NOT NULL,
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `ALTER TABLE voice_clones ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'minimax'`,
    `ALTER TABLE voice_clones ADD COLUMN IF NOT EXISTS consent_at timestamp`,
    `ALTER TABLE voice_clones ADD COLUMN IF NOT EXISTS consent_text text`,
    `CREATE TABLE IF NOT EXISTS os_tasks (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      tool text NOT NULL,
      external_task_id text,
      status text NOT NULL DEFAULT 'processing',
      title text NOT NULL DEFAULT '',
      input json,
      output json,
      error text,
      credits_charged integer NOT NULL DEFAULT 0,
      refunded boolean NOT NULL DEFAULT false,
      webhook_token text,
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS os_tasks_user_idx ON os_tasks (user_id)`,
    `CREATE INDEX IF NOT EXISTS os_tasks_external_idx ON os_tasks (external_task_id)`,
    `CREATE TABLE IF NOT EXISTS os_dictionaries (
      id serial PRIMARY KEY,
      user_id integer NOT NULL,
      external_id text NOT NULL,
      name text NOT NULL,
      rules_count integer NOT NULL DEFAULT 0,
      created_at timestamp NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS os_dictionaries_user_idx ON os_dictionaries (user_id)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS os_dictionaries_external_idx ON os_dictionaries (external_id)`,
  ];

  for (const stmt of statements) {
    await db.execute(sql.raw(stmt));
  }
  logger.info("Schema ensured (admin panel tables)");
}
