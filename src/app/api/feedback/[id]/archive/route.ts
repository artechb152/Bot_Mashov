import { NextResponse } from "next/server";
import { requireFeedbackWrite } from "@/lib/auth/feedback-access";
import { setFeedbackStatus } from "@/lib/data/feedback";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/feedback/[id]/archive — soft delete (same permission as edit).
export async function POST(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireFeedbackWrite(id);
  if (!auth.ok) return auth.response;

  try {
    const feedback = await setFeedbackStatus(id, "archived", auth.actorId);
    if (!feedback) return NextResponse.json({ error: "המשוב לא נמצא." }, { status: 404 });
    return NextResponse.json({ feedback });
  } catch (error) {
    console.error("[api/feedback/:id/archive] failed:", error);
    return NextResponse.json({ error: "ארכוב המשוב נכשל." }, { status: 500 });
  }
}
