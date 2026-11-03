import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requireTraineeAccess } from "@/lib/auth/access";
import { requireConversationAccess } from "@/lib/auth/conversation-access";
import { getConversation } from "@/lib/data/conversations";
import { saveInsight } from "@/lib/data/ai-insights";
import { buildTraineeContextFor } from "@/lib/ai/build-context";
import { runAITask } from "@/lib/ai";
import { isAITask, isAIArtifactTask } from "@/lib/ai/types";
import type { FeedbackSelection } from "@/lib/ai/context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ task: string }> };

/**
 * Run a structured AI task for a trainee. Requires live trainee access. The source
 * selection comes from the named conversation (if given + authorized), else the
 * request's ids, else all active feedback — always re-filtered server-side. Artifact
 * tasks (review/timeline/next-focus/summary) that succeed are persisted, versioned,
 * to TraineeAIInsight. Never runs the provider directly — always via `runAITask`,
 * which validates the structured output.
 */
export async function POST(request: Request, { params }: RouteContext) {
  const { task } = await params;
  if (!isAITask(task)) return NextResponse.json({ error: "משימה לא מוכרת." }, { status: 404 });
  // Import extraction is not trainee-grounded — it has its own /import/preview route.
  if (task === "trainee_file_extract") return NextResponse.json({ error: "משימה לא מוכרת." }, { status: 404 });

  let body: { traineeId?: string; conversationId?: string; input?: unknown; selectedFeedbackIds?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }
  const traineeId = body.traineeId ?? "";
  if (!isValidObjectId(traineeId)) return NextResponse.json({ error: "מזהה חניך חסר או שגוי." }, { status: 400 });

  const access = await requireTraineeAccess(traineeId);
  if (!access.ok) return access.response;

  // Resolve the source selection. loadContextFeedback (inside buildTraineeContextFor)
  // re-filters to this trainee's ACTIVE feedback, so client ids can never widen it.
  let selection: FeedbackSelection = "all";
  const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
  if (conversationId) {
    const convAuth = await requireConversationAccess(conversationId);
    if (!convAuth.ok) return convAuth.response;
    if (convAuth.meta.traineeId !== traineeId) {
      return NextResponse.json({ error: "השיחה אינה שייכת לחניך זה." }, { status: 400 });
    }
    const conv = await getConversation(conversationId);
    selection = conv ? conv.selectedFeedbackIds : [];
  } else if (Array.isArray(body.selectedFeedbackIds) && body.selectedFeedbackIds.every((x) => typeof x === "string")) {
    selection = body.selectedFeedbackIds as string[];
  }

  try {
    const context = await buildTraineeContextFor(traineeId, selection, task);
    const result = await runAITask(task, (body.input ?? {}) as never, context);

    let insight = null;
    if (result.status === "ok" && isAIArtifactTask(task)) {
      insight = await saveInsight(traineeId, {
        createdBy: access.actorId,
        conversationId: conversationId || null,
        artifactType: task,
        sourceFeedbackIds: context.feedback.map((f) => f.id),
        structuredOutput: result.output,
        contextHash: result.contextHash,
        provider: result.provider,
        model: result.model,
        systemPromptVersion: context.systemPromptVersion,
        knowledgeVersion: context.knowledgeVersion,
      });
    }

    return NextResponse.json({ result, insight, sourceCount: context.feedback.length });
  } catch (error) {
    console.error(`[api/ai/tasks/${task}] failed:`, error);
    return NextResponse.json({ error: "הרצת המשימה נכשלה." }, { status: 500 });
  }
}
