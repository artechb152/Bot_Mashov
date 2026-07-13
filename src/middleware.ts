import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";

/**
 * Guards the internal (app) routes + their APIs: without a valid session cookie,
 * page requests redirect to /login (preserving the target as ?next=), and API
 * requests get 401. The `matcher` keeps this off public routes (/, /login,
 * /signup, /api/auth/*, static assets).
 */
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;
  if (session) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/dashboard",
    "/assistant",
    "/assistant/:path*",
    "/trainees",
    "/trainees/:path*",
    // Covers the trainee APIs AND the nested attachment APIs
    // (/api/trainees/[id]/attachments/...).
    "/api/trainees/:path*",
  ],
};
