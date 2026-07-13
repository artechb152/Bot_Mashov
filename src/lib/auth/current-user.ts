import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME, verifySession, type SessionUser } from "@/lib/auth/session";

/**
 * Resolve the current authenticated user from the session cookie (server only:
 * server components, route handlers, server layouts). Identity comes straight
 * from the signed token — no DB round-trip.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}
