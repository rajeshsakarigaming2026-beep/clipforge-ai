export const DEFAULT_ADMIN_EMAILS = [
  "admin@clipforge.ai",
  "demo@clipforge.ai",
  "rajeshsakarigaming2026@gmail.com",
  "rajeshsahakari2@gmail.com",
];

export function isAdmin(email: string | null | undefined) {
  if (!email) return false;
  if (process.env.ADMIN_ALL_USERS === "true") return true;
  const configured = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const allowed = configured.length ? configured : DEFAULT_ADMIN_EMAILS;
  return allowed.includes(email.toLowerCase());
}
