import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active";
import { setThreadDeletedForUser } from "@/lib/data/messages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ threadId: string }> };

// POST /api/messages/[threadId]/delete — hide the thread FOR THIS USER only. The
// thread remains intact for every other participant.
export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  const { threadId } = await params;
  const ok = await setThreadDeletedForUser(auth.grant.userId, threadId);
  if (!ok) return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
