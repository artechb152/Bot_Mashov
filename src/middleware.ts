import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";

/**
 * Guards the internal (app) routes + their APIs: without a valid session cookie,
 * page requests redirect to the entry page `/` (preserving the target as ?next=),
 * where the login form is shown, and API requests get 401. The `matcher` keeps this
 * off public routes (/, /login, /signup, /api/auth/*, static assets).
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (session) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }

  const entryUrl = new URL("/", req.url);
  entryUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(entryUrl);
}

export const config = {
  matcher: [
    "/dashboard",
    "/workspace",
    "/workspace/:path*",
    "/assistant",
    "/assistant/:path*",
    "/trainees",
    "/trainees/:path*",
    // The one-time course picker: needs a session, but NOT a course (that is the
    // whole point of it), so it is guarded here rather than by the (app) layout.
    "/select-course",
    "/api/auth/course",
    // Covers the trainee APIs AND the nested attachment/feedback/insight APIs
    // (/api/trainees/[id]/attachments|feedback|insights/...).
    "/api/trainees/:path*",
    // Feedback edit/archive/restore + the AI conversation/task APIs. Session-presence
    // only on the edge; the real gates are requireTraineeAccess / requireConversation
    // Access on every handler. This just closes the "unmatched route" gap.
    "/api/feedback/:path*",
    "/api/ai/:path*",
    // Selectable-cohorts lookup for the trainee form (session-gated in the handler).
    "/api/cohorts",
    "/api/cohorts/:path*",
    // Management + collaboration areas — SESSION-PRESENCE check only. Role/status
    // can't be verified on the edge (no DB), so the real gates are the layouts +
    // require*() on every handler; this just closes the "unmatched route" gap.
    "/admin",
    "/admin/:path*",
    "/api/admin/:path*",
    "/system",
    "/system/:path*",
    "/api/system/:path*",
    "/settings/:path*",
    "/api/settings/:path*",
    "/directory",
    "/directory/:path*",
    "/messages",
    "/messages/:path*",
    "/requests",
    "/requests/:path*",
    "/notifications",
    "/notifications/:path*",
    "/api/directory/:path*",
    "/api/messages/:path*",
    "/api/requests/:path*",
    "/api/notifications/:path*",
  ],
};
