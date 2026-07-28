import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active";
import { markRead } from "@/lib/data/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/notifications/[id]/read — mark one notification read (own only).
export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  await markRead(auth.grant.userId, id);
  return NextResponse.json({ ok: true });
}
