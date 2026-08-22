import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable, emailVerificationsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import { isAdminEmail } from "../lib/admin";
import { planCredits, freeTrialExpiresAt } from "../lib/plans";
import { logger } from "../lib/logger";
import { emailEnabled, sendEmail, verificationCodeEmail } from "../lib/email";

const router = Router();

/* ── Email verification for signups ─────────────────────────────────────
   Codes go out from our support address (Resend). Accounts are only created
   after the emailed 6-digit code is confirmed. Disposable/temp mail is kept
   out by allowing only the major consumer providers. */

// Toggle: when false, signups skip the emailed code and accounts are created
// immediately (the domain allowlist still applies). Flip to true once the
// Resend domain + keys are configured in production.
const EMAIL_VERIFICATION_ENABLED = false;

const ALLOWED_EMAIL_DOMAINS = new Set(["gmail.com", "icloud.com", "outlook.com", "hotmail.com"]);
const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_CODE_ATTEMPTS = 8;

function emailDomainAllowed(email: string): boolean {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return ALLOWED_EMAIL_DOMAINS.has(domain);
}

const hashCode = (code: string) => crypto.createHash("sha256").update(code).digest("hex");
const newCode = () => String(crypto.randomInt(100000, 1000000));

async function emailAlreadyRegistered(email: string): Promise<boolean> {
  const rows = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  return rows.length > 0;
}

/**
 * Sanitize a caller-supplied returnTo into a safe same-origin path. Anything
 * that is not a simple relative path (no scheme, no host, no protocol-relative
 * "//") collapses to "/". Prevents open-redirect via the OAuth flow.
 */
function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== "string") return "/";
  const v = value.trim();
  if (!v.startsWith("/")) return "/";       // must be a relative path
  if (v.startsWith("//") || v.startsWith("/\\")) return "/"; // protocol-relative
  if (/[\r\n]/.test(v)) return "/";
  if (v.length > 512) return "/";
  return v;
}

router.post("/register", async (req, res) => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  if (!emailDomainAllowed(email)) {
    res.status(400).json({ error: "Only Gmail, iCloud, Outlook or Hotmail email addresses are accepted." });
    return;
  }
  if (await emailAlreadyRegistered(email)) {
    res.status(409).json({ error: "Email is already registered" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  if (!EMAIL_VERIFICATION_ENABLED) {
    const [user] = await db.insert(usersTable)
      .values({ name, email, passwordHash, credits: planCredits("free"), planExpiresAt: isAdminEmail(email) ? null : freeTrialExpiresAt(), signupIp: req.ip ?? null })
      .returning();
    await loginSession(req, user.id);
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      isAdmin: user.isAdmin || isAdminEmail(user.email),
      createdAt: user.createdAt.toISOString(),
    });
    return;
  }

  const code = newCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await db.insert(emailVerificationsTable)
    .values({ email, name, passwordHash, codeHash: hashCode(code), expiresAt, lastSentAt: new Date() })
    .onConflictDoUpdate({
      target: emailVerificationsTable.email,
      set: { name, passwordHash, codeHash: hashCode(code), attempts: 0, expiresAt, lastSentAt: new Date() },
    });

  const tpl = verificationCodeEmail(name, code);
  const sent = await sendEmail(email, tpl.subject, tpl.html);
  if (!sent) {
    if (emailEnabled() || process.env.NODE_ENV === "production") {
      // Send failed (or email service missing in production) — never leave the
      // user stuck on a code screen that can't receive a code.
      res.status(503).json({ error: "We could not send the verification email right now. Please try again in a few minutes." });
      return;
    }
    // Email service not configured (development): log the code so the flow stays testable.
    logger.warn({ email, code }, "Email service not configured — verification code logged for development");
  }

  res.status(202).json({ verificationRequired: true, email });
});

router.post("/register/verify", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  if (!email || !/^\d{6}$/.test(code)) {
    res.status(400).json({ error: "Invalid code" });
    return;
  }

  const [row] = await db.select().from(emailVerificationsTable).where(eq(emailVerificationsTable.email, email));
  if (!row) {
    res.status(400).json({ error: "No pending signup for this email. Please sign up again." });
    return;
  }
  if (row.expiresAt.getTime() < Date.now()) {
    res.status(400).json({ error: "This code has expired. Please request a new one." });
    return;
  }
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    res.status(429).json({ error: "Too many wrong attempts. Please request a new code." });
    return;
  }
  if (hashCode(code) !== row.codeHash) {
    await db.update(emailVerificationsTable)
      .set({ attempts: sql`${emailVerificationsTable.attempts} + 1` })
      .where(eq(emailVerificationsTable.id, row.id));
    res.status(400).json({ error: "Incorrect code. Please check the email and try again." });
    return;
  }

  if (await emailAlreadyRegistered(email)) {
    await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.id, row.id));
    res.status(409).json({ error: "Email is already registered" });
    return;
  }

  const [user] = await db.insert(usersTable)
    .values({ name: row.name, email, passwordHash: row.passwordHash, credits: planCredits("free"), planExpiresAt: isAdminEmail(email) ? null : freeTrialExpiresAt(), signupIp: req.ip ?? null })
    .returning();
  await db.delete(emailVerificationsTable).where(eq(emailVerificationsTable.id, row.id));

  await loginSession(req, user.id);

  res.status(201).json({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin || isAdminEmail(user.email),
    createdAt: user.createdAt.toISOString(),
  });
});

router.post("/register/resend", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const [row] = await db.select().from(emailVerificationsTable).where(eq(emailVerificationsTable.email, email));
  if (!row) {
    res.status(400).json({ error: "No pending signup for this email. Please sign up again." });
    return;
  }
  if (Date.now() - row.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
    res.status(429).json({ error: "Please wait a minute before requesting another code." });
    return;
  }

  const code = newCode();
  await db.update(emailVerificationsTable)
    .set({ codeHash: hashCode(code), attempts: 0, expiresAt: new Date(Date.now() + CODE_TTL_MS), lastSentAt: new Date() })
    .where(eq(emailVerificationsTable.id, row.id));

  const tpl = verificationCodeEmail(row.name, code);
  const sent = await sendEmail(email, tpl.subject, tpl.html);
  if (!sent && (emailEnabled() || process.env.NODE_ENV === "production")) {
    res.status(503).json({ error: "We could not send the verification email right now. Please try again in a few minutes." });
    return;
  }
  if (!sent) logger.warn({ email, code }, "Email service not configured — verification code logged for development");

  res.json({ ok: true });
});

router.post("/login", async (req, res) => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  await loginSession(req, user.id);

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin || isAdminEmail(user.email),
    isReseller: user.isReseller,
    createdAt: user.createdAt.toISOString(),
  });
});

/* ── Google OAuth ── */
// Prefer a canonical configured origin (e.g. https://www.openradio.io) over
// request headers; fall back to the request host for dev environments.
function googleRedirectUri(req: { protocol: string; get(name: string): string | undefined }) {
  const origin = process.env.APP_ORIGIN?.replace(/\/+$/, "");
  const base = origin || `${req.protocol}://${req.get("host")}`;
  return `${base}/api/auth/google/callback`;
}

// Regenerate the session on privilege change to prevent session fixation.
function loginSession(req: { session: any }, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err: unknown) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((err2: unknown) => (err2 ? reject(err2) : resolve()));
    });
  });
}

router.get("/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(500).json({ error: "Google login is not configured" });
    return;
  }
  const state = crypto.randomBytes(16).toString("hex");
  req.session.oauthState = state;
  // Remember where to return the user after login (e.g. a checkout page that
  // carries the selected plan/currency). Stored alongside the OAuth state.
  req.session.oauthReturnTo = sanitizeReturnTo(req.query.returnTo);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

router.get("/google/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const sess = req.session;
    if (typeof code !== "string" || !code || typeof state !== "string" || !sess.oauthState || state !== sess.oauthState) {
      res.redirect("/login?error=google");
      return;
    }
    // Consume the stored returnTo before regeneration wipes the session.
    const returnTo = sanitizeReturnTo(sess.oauthReturnTo);
    delete sess.oauthState;
    delete sess.oauthReturnTo;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        redirect_uri: googleRedirectUri(req),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      logger.error({ status: tokenRes.status, body: await tokenRes.text() }, "Google token exchange failed");
      res.redirect("/login?error=google");
      return;
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) {
      res.redirect("/login?error=google");
      return;
    }

    const infoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!infoRes.ok) {
      res.redirect("/login?error=google");
      return;
    }
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
    const email = (info.email ?? "").toLowerCase();
    if (!email || !info.email_verified) {
      res.redirect("/login?error=google");
      return;
    }

    let [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!user) {
      const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);
      [user] = await db
        .insert(usersTable)
        .values({ name: info.name || email.split("@")[0], email, passwordHash, credits: planCredits("free"), planExpiresAt: isAdminEmail(email) ? null : freeTrialExpiresAt(), signupIp: req.ip ?? null })
        .returning();
    }

    // returnTo was already sanitized above; regeneration wipes the old
    // session, so we do not need to carry it forward — redirect directly.
    await loginSession(req, user.id);
    res.redirect(returnTo);
  } catch (err) {
    logger.error({ err }, "Google OAuth error");
    res.redirect("/login?error=google");
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.status(204).send();
  });
});

router.get("/me", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    isAdmin: user.isAdmin || isAdminEmail(user.email),
    isReseller: user.isReseller,
    plan: user.plan,
    credits: user.credits,
    creditsUsed: user.creditsUsed,
    planExpiresAt: user.planExpiresAt?.toISOString() ?? null,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  });
});

/* ── PATCH /profile — update email and/or password ── */
router.patch("/profile", async (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { email, currentPassword, newPassword } = req.body as {
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const updates: Partial<{ email: string; passwordHash: string }> = {};

  if (email && email.toLowerCase() !== user.email) {
    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
    if (existing.length > 0) {
      res.status(409).json({ error: "Email already in use by another account" });
      return;
    }
    updates.email = email.toLowerCase();
  }

  if (newPassword) {
    if (!currentPassword) {
      res.status(400).json({ error: "Current password is required to set a new password" });
      return;
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" });
      return;
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();

  res.json({
    id: updated.id,
    name: updated.name,
    email: updated.email,
    createdAt: updated.createdAt.toISOString(),
  });
});

export default router;
