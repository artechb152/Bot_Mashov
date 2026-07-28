import { NextResponse } from "next/server";
import { requireTraineeAccess } from "@/lib/auth/access";
import { listGrantsForTrainee } from "@/lib/data/trainee-grants";
import { User } from "@/models";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/trainees/[id]/grants — active access grants on a trainee. Gated by
// requireTraineeAccess (admin/super in scope; a plain owner may also view).
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const access = await requireTraineeAccess(id);
  if (!access.ok) return access.response;
  // Only managers manage grants here.
  if (access.via !== "course_admin" && access.via !== "super_admin") {
    return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 403 });
  }
  const grants = await listGrantsForTrainee(id);
  const names = new Map(
    (await User.find({ _id: { $in: grants.map((g) => g.granteeUserId) } }).select("_id displayName username").lean<{ _id: unknown; displayName?: string; username?: string }[]>())
      .map((u) => [String(u._id), u.displayName || u.username || ""]),
  );
  return NextResponse.json({
    grants: grants.map((g) => ({ ...g, granteeName: names.get(g.granteeUserId) ?? g.granteeUserId })),
  });
}
