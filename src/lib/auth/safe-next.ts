/**
 * Sanitise a `?next=` redirect target to prevent open redirects. Only same-origin
 * absolute paths are allowed — anything protocol-relative ("//host", "/\\host")
 * or containing a backslash (which browsers normalise to "/") falls back to
 * `fallback`. The fallback defaults to the work area (`/workspace`) — the post-login
 * home for every role — but callers can override it (e.g. "/" for the entry page).
 */
export function safeNextPath(next: string | undefined | null, fallback: string = "/workspace"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  // Never bounce a successful login back to the public entry page — send it home.
  if (next === "/") return fallback;
  return next;
}
