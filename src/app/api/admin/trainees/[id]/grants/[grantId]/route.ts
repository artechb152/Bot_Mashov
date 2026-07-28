import { NextResponse } from "next/server";
import { requireTraineeAccess } from "@/lib/auth/access";
import { revokeTraineeAccess } from "@/lib/data/trainee-grants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string; grantId: string }> };

// DELETE /api/admin/trainees/[id]/grants/[grantId] — revoke a trainee-access grant.
// Only a course admin or super-admin (in scope) may revoke. Audited.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const { id, grantId } = await params;
  const access = await requireTraineeAccess(id);
  if (!access.ok) return access.response;
  if (access.via !== "course_admin" && access.via !== "super_admin") {
    return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 403 });
  }
  const result = await revokeTraineeAccess(grantId, access.actorId);
  if (result.ok) return NextResponse.json({ ok: true });
  return NextResponse.json({ error: "ההרשאה לא נמצאה." }, { status: 404 });
}
