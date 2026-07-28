import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active";
import { deleteDraft, getDraft } from "@/lib/data/messages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/messages/drafts/[id] — one draft (own only).
export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const draft = await getDraft(auth.grant.userId, id);
  if (!draft) return NextResponse.json({ error: "הטיוטה לא נמצאה." }, { status: 404 });
  return NextResponse.json({ draft });
}

// DELETE /api/messages/drafts/[id] — delete a draft (own only).
export async function DELETE(_request: Request, { params }: RouteContext) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  await deleteDraft(auth.grant.userId, id);
  return NextResponse.json({ ok: true });
}
