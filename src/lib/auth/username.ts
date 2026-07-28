/**
 * Canonical username normalization for uniqueness checks. Hebrew is fully
 * supported (Hebrew has no case, so lowercasing only affects Latin characters);
 * internal whitespace is collapsed and the value is trimmed. The normalized form
 * is stored on `User.normalizedUsername` (unique) so "Dan" and "dan " collide,
 * while the display `username` keeps the user's original casing/spacing.
 *
 * Usernames are NEVER used as foreign keys — relationships use ObjectIds — so a
 * user may change their username freely without breaking any reference.
 */
export function normalizeUsername(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
