import { NextResponse } from "next/server";
import { requireConversationAccess } from "@/lib/auth/conversation-access";
import { getConversation, listTurns, updateConversation } from "@/lib/data/conversations";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/ai/conversations/[id] — the conversation + its turns (owner / authorized manager).
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireConversationAccess(id);
  if (!auth.ok) return auth.response;

  try {
    const [conversation, turns] = await Promise.all([getConversation(id), listTurns(id)]);
    if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה." }, { status: 404 });
    return NextResponse.json({ conversation, turns });
  } catch (error) {
    console.error("[api/ai/conversations/:id] GET failed:", error);
    return NextResponse.json({ error: "טעינת השיחה נכשלה." }, { status: 500 });
  }
}

// PATCH /api/ai/conversations/[id] — update title and/or the AI source selection.
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireConversationAccess(id);
  if (!auth.ok) return auth.response;

  let body: { title?: unknown; selectedFeedbackIds?: unknown };
  try {
    body = (await request.json()) as { title?: unknown; selectedFeedbackIds?: unknown };
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }

  const update: { title?: string; selectedFeedbackIds?: string[] } = {};
  if (body.title !== undefined) {
    if (typeof body.title !== "string") return NextResponse.json({ error: "כותרת אינה תקינה." }, { status: 400 });
    update.title = body.title;
  }
  if (body.selectedFeedbackIds !== undefined) {
    if (!Array.isArray(body.selectedFeedbackIds) || !body.selectedFeedbackIds.every((x) => typeof x === "string")) {
      return NextResponse.json({ error: "בחירת המשובים אינה תקינה." }, { status: 400 });
    }
    // Kept even when empty — an explicit empty selection is preserved (not reset to all).
    update.selectedFeedbackIds = body.selectedFeedbackIds as string[];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "לא נשלחו שדות לעדכון." }, { status: 400 });
  }

  try {
    // The data layer sanitizes selectedFeedbackIds against THIS trainee's feedback.
    const conversation = await updateConversation(id, auth.meta.traineeId, update);
    if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה." }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (error) {
    console.error("[api/ai/conversations/:id] PATCH failed:", error);
    return NextResponse.json({ error: "עדכון השיחה נכשל." }, { status: 500 });
  }
}
