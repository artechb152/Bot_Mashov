import { NextResponse } from "next/server";
import { requireRootSuperAdmin } from "@/lib/auth/require-root";
import { adminSetUserRole } from "@/lib/data/admin";
import { isUserRole } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/admin/users/[id]/role — change a user's role. ROOT super-admin only
// (spec §12). Body: { role: UserRole, confirm?: boolean }
export async function PATCH(request: Request, { params }: RouteContext) {
  const auth = await requireRootSuperAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isUserRole(b.role)) {
    return NextResponse.json({ error: "תפקיד לא תקין." }, { status: 400 });
  }
  const confirmSelf = b.confirm === true;

  try {
    const result = await adminSetUserRole(auth.grant, id, b.role, { confirmSelf });
    if (result.ok) return NextResponse.json({ user: result.user });

    switch (result.reason) {
      case "not_found":
        return NextResponse.json({ error: "המשתמש לא נמצא." }, { status: 404 });
      case "last_admin":
        return NextResponse.json({ error: "לא ניתן להסיר את המנהל האחרון." }, { status: 409 });
      case "self_needs_confirm":
        // 409 + a flag the client uses to open the self-demotion confirm dialog.
        return NextResponse.json(
          { error: "כדי להסיר את הרשאת הניהול של עצמך יש לאשר את הפעולה.", needsConfirm: true },
          { status: 409 },
        );
      case "root_protected":
      case "not_privileged":
      case "out_of_scope":
        return NextResponse.json(
          { error: "אין לך הרשאה לצפות או לבצע פעולה זו." },
          { status: 403 },
        );
      case "root_required":
        return NextResponse.json(
          { error: "פעולה זו שמורה למנהל־על ראשי בלבד." },
          { status: 403 },
        );
    }
  } catch (error) {
    console.error("[api/admin/users/:id/role] PATCH failed:", error);
    return NextResponse.json({ error: "עדכון התפקיד נכשל." }, { status: 500 });
  }
}
