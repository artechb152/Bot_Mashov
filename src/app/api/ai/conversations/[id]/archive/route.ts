import { NextResponse } from "next/server";
import { requireConversationAccess } from "@/lib/auth/conversation-access";
import { setConversationStatus } from "@/lib/data/conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/ai/conversations/[id]/archive — soft archive (owner / authorized manager).
export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireConversationAccess(id);
  if (!auth.ok) return auth.response;

  try {
    const conversation = await setConversationStatus(id, "archived");
    if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה." }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("[api/ai/conversations/:id/archive] failed:", error);
    return NextResponse.json({ error: "ארכוב השיחה נכשל." }, { status: 500 });
  }
}
