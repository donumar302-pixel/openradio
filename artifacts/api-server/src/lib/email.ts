import { db, usersTable } from "@workspace/db";
import { and, eq, gte, isNotNull, lte, ne, or, isNull, sql } from "drizzle-orm";
import { logger } from "./logger";

/**
 * Transactional email via Resend (https://resend.com). Fails soft: when
 * RESEND_API_KEY is missing or the API errors, we log and move on — email
 * must never break the main flow (order approval, sweeps, etc).
 */

const FROM = () => process.env.EMAIL_FROM || "OpenRadio <onboarding@resend.dev>";

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    logger.warn({ to, subject }, "Email skipped — RESEND_API_KEY not set");
    return false;
  }
  if (!to || !to.includes("@")) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: [to], subject, html }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.warn({ to, subject, status: res.status, body: body.slice(0, 300) }, "Resend send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, to, subject }, "Resend send error");
    return false;
  }
}

/* ── Templates ───────────────────────────────────────────────────────── */

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
    <div style="background:#111827;padding:18px 24px;">
      <span style="color:#ffffff;font-size:18px;font-weight:bold;">OpenRadio</span>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 12px;font-size:18px;color:#111827;">${title}</h2>
      ${bodyHtml}
      <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">This is an automated message from OpenRadio. Please do not reply to this email.</p>
    </div>
  </div></body></html>`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function orderApprovedEmail(name: string, plan: string, credits: number, expiresAt: Date | null): { subject: string; html: string } {
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  return {
    subject: `Your ${planName} plan is now active 🎉`,
    html: layout("Payment approved — plan activated", `
      <p style="font-size:14px;color:#374151;">Hi ${esc(name)},</p>
      <p style="font-size:14px;color:#374151;">Great news — your payment was verified and your <b>${esc(planName)}</b> plan is now active.</p>
      <table style="font-size:14px;color:#374151;margin:12px 0;">
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Plan</td><td><b>${esc(planName)}</b></td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Credits</td><td><b>${credits.toLocaleString("en-US")}</b></td></tr>
        ${expiresAt ? `<tr><td style="padding:4px 12px 4px 0;color:#6b7280;">Valid until</td><td><b>${expiresAt.toDateString()}</b></td></tr>` : ""}
      </table>
      <p style="font-size:14px;color:#374151;">You can start generating right away.</p>`),
  };
}

export function orderRejectedEmail(name: string, plan: string, note: string | null): { subject: string; html: string } {
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  return {
    subject: `Your ${planName} plan order could not be approved`,
    html: layout("Order not approved", `
      <p style="font-size:14px;color:#374151;">Hi ${esc(name)},</p>
      <p style="font-size:14px;color:#374151;">Unfortunately we couldn't verify the payment for your <b>${esc(planName)}</b> plan order.</p>
      ${note ? `<p style="font-size:14px;color:#374151;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 12px;"><b>Note from our team:</b> ${esc(note)}</p>` : ""}
      <p style="font-size:14px;color:#374151;">If you believe this is a mistake, please submit a new order with a clear payment proof, or contact support from your dashboard.</p>`),
  };
}

export function planExpiringEmail(name: string, plan: string, expiresAt: Date): { subject: string; html: string } {
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1);
  return {
    subject: `Your ${planName} plan expires on ${expiresAt.toDateString()}`,
    html: layout("Your plan is expiring soon", `
      <p style="font-size:14px;color:#374151;">Hi ${esc(name)},</p>
      <p style="font-size:14px;color:#374151;">Your <b>${esc(planName)}</b> plan expires on <b>${expiresAt.toDateString()}</b>. Renew now to keep your credits and premium tools without interruption.</p>
      <p style="font-size:14px;color:#374151;">Open your dashboard → <b>Pricing</b> to renew.</p>`),
  };
}

/* ── Daily plan-expiry reminder sweep ────────────────────────────────── */

const EXPIRY_WINDOW_MS = 3 * 24 * 60 * 60 * 1000; // remind 3 days ahead
const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000;     // check every 6 hours

export async function sweepExpiringPlans(): Promise<void> {
  if (!emailEnabled()) return;
  const now = new Date();
  const windowEnd = new Date(now.getTime() + EXPIRY_WINDOW_MS);
  // Users whose paid plan expires within the window and who haven't been
  // reminded for THIS expiry date yet (renewal moves the date → new reminder).
  const rows = await db.select().from(usersTable).where(and(
    ne(usersTable.plan, "free"),
    eq(usersTable.status, "active"),
    isNotNull(usersTable.planExpiresAt),
    gte(usersTable.planExpiresAt, now),
    lte(usersTable.planExpiresAt, windowEnd),
    or(isNull(usersTable.expiryNotifiedAt), sql`${usersTable.expiryNotifiedAt} <> ${usersTable.planExpiresAt}`),
  )).limit(50);

  for (const u of rows) {
    if (!u.planExpiresAt) continue;
    // Mark first (idempotent claim) so a crashed send can't spam on retries.
    const claimed = await db.update(usersTable)
      .set({ expiryNotifiedAt: u.planExpiresAt })
      .where(and(
        eq(usersTable.id, u.id),
        or(isNull(usersTable.expiryNotifiedAt), sql`${usersTable.expiryNotifiedAt} <> ${usersTable.planExpiresAt}`),
      )).returning({ id: usersTable.id });
    if (claimed.length === 0) continue;
    const t = planExpiringEmail(u.name, u.plan, u.planExpiresAt);
    await sendEmail(u.email, t.subject, t.html);
  }
}

export function startPlanExpiryEmailSweeper(): NodeJS.Timeout {
  const run = () => sweepExpiringPlans().catch((err) => logger.warn({ err }, "Plan-expiry email sweep failed"));
  setTimeout(run, 30_000).unref();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref();
  return timer;
}
