import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/require-admin";
import { revokeInvite } from "@/lib/data/invites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/system/invites/[id]/revoke — revoke an unused invite (super-admin only).
export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const result = await revokeInvite(auth.grant.adminId, id);
  if (result.ok) return NextResponse.json({ invite: result.invite });

  switch (result.reason) {
    case "not_found":
      return NextResponse.json({ error: "קוד ההרשאה לא נמצא." }, { status: 404 });
    case "not_active":
      return NextResponse.json({ error: "לא ניתן לבטל קוד שאינו פעיל." }, { status: 409 });
  }
}
