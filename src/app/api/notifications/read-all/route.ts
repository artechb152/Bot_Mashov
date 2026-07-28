import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active";
import { markAllRead } from "@/lib/data/notifications";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/notifications/read-all — mark all of the current user's notifications read.
export async function POST() {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  const count = await markAllRead(auth.grant.userId);
  return NextResponse.json({ ok: true, count });
}
