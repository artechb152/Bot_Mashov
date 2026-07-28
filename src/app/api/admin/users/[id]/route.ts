import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminUser, listTraineesForUser } from "@/lib/data/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/admin/users/[id] — a user plus their trainees (admin only).
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  try {
    const user = await getAdminUser(auth.grant, id);
    if (!user) return NextResponse.json({ error: "המשתמש לא נמצא." }, { status: 404 });
    const trainees = await listTraineesForUser(auth.grant, id);
    return NextResponse.json({ user, trainees });
  } catch (error) {
    console.error("[api/admin/users/:id] GET failed:", error);
    return NextResponse.json({ error: "טעינת המשתמש נכשלה." }, { status: 500 });
  }
}
