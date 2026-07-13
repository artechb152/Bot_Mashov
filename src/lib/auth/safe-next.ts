/**
 * Sanitise a `?next=` redirect target to prevent open redirects. Only same-origin
 * absolute paths are allowed — anything protocol-relative ("//host", "/\\host")
 * or containing a backslash (which browsers normalise to "/") falls back to "/".
 */
export function safeNextPath(next: string | undefined | null): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.includes("\\")) return "/";
  return next;
}
