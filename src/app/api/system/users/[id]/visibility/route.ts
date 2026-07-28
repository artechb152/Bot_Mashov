import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { adminSetUserVisibility } from "@/lib/data/admin";
import { isDirectoryVisibility } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// PATCH /api/system/users/[id]/visibility — set directory visibility (super-admin).
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
  if (!isDirectoryVisibility(b.visibility)) {
    return NextResponse.json({ error: "ערך לא תקין." }, { status: 400 });
  }

  const result = await adminSetUserVisibility(auth.grant, id, b.visibility);
  if (result.ok) return NextResponse.json({ user: result.user });
  if (result.reason === "root_protected") {
    return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 403 });
  }
  return NextResponse.json({ error: "המשתמש לא נמצא." }, { status: 404 });
}
