const STATIC_ADMIN_EMAILS = ["helpusmanecom@gmail.com"];

const ADMIN_EMAILS = new Set<string>(
  [
    ...STATIC_ADMIN_EMAILS,
    ...(process.env.ADMIN_EMAILS ?? "").split(","),
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.has(email.toLowerCase());
}
