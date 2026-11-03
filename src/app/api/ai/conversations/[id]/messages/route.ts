import { NextResponse } from "next/server";
import { requireConversationAccess } from "@/lib/auth/conversation-access";
import { addTurn, getConversation, listTurns } from "@/lib/data/conversations";
import { buildTraineeContextFor } from "@/lib/ai/build-context";
import { runAITask } from "@/lib/ai";
import type { AIChatMessage } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/ai/conversations/[id]/messages — send a chat message; runs the provider
// over the conversation's SELECTED feedback (re-loaded fresh) and appends the turns.
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await requireConversationAccess(id);
  if (!auth.ok) return auth.response;

  let body: { content?: unknown };
  try {
    body = (await request.json()) as { content?: unknown };
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) return NextResponse.json({ error: "תוכן ההודעה ריק." }, { status: 400 });

  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: "השיחה לא נמצאה." }, { status: 404 });

  try {
    // Persist the user's turn first (survives even if no provider is configured).
    const userTurn = await addTurn(id, { role: "user", content, taskType: "chat" });

    const priorTurns = await listTurns(id);
    const messages: AIChatMessage[] = priorTurns
      .filter((t) => t.role === "user" || t.role === "assistant")
      .map((t) => ({ role: t.role as "user" | "assistant", content: t.content }));

    const context = await buildTraineeContextFor(conversation.traineeId, conversation.selectedFeedbackIds, "chat");
    const result = await runAITask("chat", { messages }, context);

    // Only persist the assistant turn on a valid answer — never a partial/failed one.
    let assistantTurn = null;
    if (result.status === "ok") {
      assistantTurn = await addTurn(id, {
        role: "assistant",
        content: result.output.reply,
        taskType: "chat",
        structuredOutput: result.output,
        provider: result.provider,
        model: result.model,
        usage: result.usage,
      });
    }

    return NextResponse.json({ result, userTurn, assistantTurn, sourceCount: context.feedback.length });
  } catch (error) {
    console.error("[api/ai/conversations/:id/messages] failed:", error);
    return NextResponse.json({ error: "שליחת ההודעה נכשלה." }, { status: 500 });
  }
}
