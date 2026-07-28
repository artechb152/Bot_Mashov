import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active";
import { setThreadArchived } from "@/lib/data/messages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ threadId: string }> };

// POST /api/messages/[threadId]/archive — archive/unarchive FOR THIS USER only.
export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  const { threadId } = await params;
  const b = (await request.json().catch(() => ({}))) as { archived?: boolean };
  const ok = await setThreadArchived(auth.grant.userId, threadId, b.archived !== false);
  if (!ok) return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
