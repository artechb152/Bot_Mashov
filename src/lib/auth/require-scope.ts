import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { scopeFromSession, type OwnerScope } from "@/lib/data/scope";

/**
 * The single auth gate for every course-scoped API route.
 *
 * Collapses the two checks each route needs — "is there a session?" and "does it
 * carry a course?" — into one call, so no route can accidentally query the data
 * layer with only half a scope. On failure it hands back the exact Response to
 * return, which keeps the "every code path returns a Response" property trivial
 * to hold.
 */
export type ScopeResult =
  | { ok: true; scope: OwnerScope }
  | { ok: false; response: NextResponse };

export async function requireScope(): Promise<ScopeResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 }),
    };
  }

  const scope = scopeFromSession(user);
  if (!scope) {
    // Authenticated, but a legacy account that has not passed through
    // /select-course yet — so there is no course to scope the query by.
    return {
      ok: false,
      response: NextResponse.json(
        { error: "יש לבחור קורס לפני המשך העבודה." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, scope };
}
