import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { issueInvite, listInvites } from "@/lib/data/invites";
import { isAdminPosition, type AdminPosition } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/system/invites — list invites (super-admin only).
export async function GET() {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const invites = await listInvites();
  return NextResponse.json({ invites });
}

// POST /api/system/invites — issue a one-time admin invite (super-admin only).
// Body: { courseId, allowedAdminPositions?: AdminPosition[], expiresInHours?: number }
// The plaintext code is returned ONCE and never again.
export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const courseId = typeof b.courseId === "string" ? b.courseId : "";
  const positions = Array.isArray(b.allowedAdminPositions)
    ? (b.allowedAdminPositions.filter(isAdminPosition) as AdminPosition[])
    : [];
  const expiresInHours = typeof b.expiresInHours === "number" ? b.expiresInHours : 24;

  const result = await issueInvite(auth.grant.adminId, {
    courseId,
    allowedAdminPositions: positions,
    expiresInHours,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "יצירת קוד ההרשאה נכשלה. ודא שנבחר קורס תקין." }, { status: 400 });
  }
  // `plaintext` is included ONCE here and never in any later response.
  return NextResponse.json({ invite: result.invite, code: result.plaintext }, { status: 201 });
}
