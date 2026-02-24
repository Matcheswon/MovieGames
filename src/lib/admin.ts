export const ADMIN_EMAILS = [
  "movienightshane@gmail.com",
  "nicholas.johnson78@gmail.com",
];

export function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
