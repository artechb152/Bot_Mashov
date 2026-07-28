import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { adminSetUserStatus } from "@/lib/data/admin";
import { isUserStatus } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/system/users/[id]/status — suspend/disable/reactivate (super-admin).
// Root targets and last-active-manager are protected by the data layer + policy.
export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUserStatus(b.status)) {
    return NextResponse.json({ error: "סטטוס לא תקין." }, { status: 400 });
  }
  const reason = typeof b.reason === "string" ? b.reason : undefined;

  const result = await adminSetUserStatus(auth.grant, id, b.status, { reason });
  if (result.ok) return NextResponse.json({ user: result.user });

  const map: Record<string, [string, number]> = {
    not_found: ["המשתמש לא נמצא.", 404],
    last_admin: ["לא ניתן להשבית את המנהל הפעיל האחרון.", 409],
    self_forbidden: ["לא ניתן לשנות את הסטטוס של החשבון שלך.", 409],
    root_protected: ["אין לך הרשאה לצפות או לבצע פעולה זו.", 403],
    root_required: ["פעולה זו שמורה למנהל־על ראשי בלבד.", 403],
    not_privileged: ["אין לך הרשאה לצפות או לבצע פעולה זו.", 403],
    out_of_scope: ["אין לך הרשאה לצפות או לבצע פעולה זו.", 403],
  };
  const [msg, status] = map[result.reason] ?? ["עדכון הסטטוס נכשל.", 400];
  return NextResponse.json({ error: msg }, { status });
}
