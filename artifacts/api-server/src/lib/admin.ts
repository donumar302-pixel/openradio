const STATIC_ADMIN_EMAILS = ["helpusmanecom@gmail.com", "donumar302@gmail.com"];

const ADMIN_EMAILS = new Set<string>(
  [
    ...STATIC_ADMIN_EMAILS,
    ...(process.env.ADMIN_EMAILS ?? "").split(","),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** All allowlisted admin emails (lowercased) — for SQL predicates that must
 *  exempt admins even when their is_admin flag is false. */
export function adminEmailList(): string[] {
  return [...ADMIN_EMAILS];
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
