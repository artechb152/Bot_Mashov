import { buildTraineeAIContext, type FeedbackSelection } from "@/lib/ai/context";
import { loadAISystemKnowledge } from "@/lib/ai/knowledge";
import { loadContextFeedback } from "@/lib/data/conversations";
import { readTraineeById } from "@/lib/data/trainees";
import type { AIContext, AITask } from "@/lib/ai/types";

/**
 * Assemble the authorized {@link AIContext} for a trainee-grounded AI call. **Server
 * only.** MUST be called only after the route authorized the caller against the
 * trainee. It re-loads the source feedback fresh (active + selected + belonging —
 * client ids are never trusted) via `loadContextFeedback`, so the resulting context
 * can only contain feedback the caller is allowed to use. `task` selects which
 * per-task reference knowledge (guides/examples) is loaded (e.g. the final-evaluation
 * guide for `final_evaluation`); omit it (or pass "chat") for base knowledge only.
 */
export async function buildTraineeContextFor(
  traineeId: string,
  selection: FeedbackSelection,
  task?: AITask,
): Promise<AIContext> {
  const [knowledge, trainee, feedback] = await Promise.all([
    loadAISystemKnowledge(task),
    readTraineeById(traineeId),
    loadContextFeedback(traineeId, selection),
  ]);

  return buildTraineeAIContext({
    systemPrompt: knowledge.systemPrompt,
    systemPromptVersion: knowledge.systemPromptVersion,
    knowledgeExcerpts: knowledge.knowledgeExcerpts,
    taskKnowledge: knowledge.taskKnowledge,
    knowledgeVersion: knowledge.knowledgeVersion,
    trainee: trainee
      ? { id: trainee.id, fullName: trainee.fullName, courseType: trainee.courseType, team: trainee.team }
      : null,
    // `feedback` is already active + selected; pass "all" so nothing is re-filtered out.
    allFeedback: feedback,
    selection: "all",
  });
}

/**
 * Assemble the context for the import EXTRACTION task. **Server only.** There is no
 * trainee yet — the document text is passed as the task INPUT (never the binary), and
 * only the base system knowledge is loaded so the model extracts, it does not review.
 */
export async function buildExtractionContext(): Promise<AIContext> {
  const knowledge = await loadAISystemKnowledge("trainee_file_extract");
  return buildTraineeAIContext({
    systemPrompt: knowledge.systemPrompt,
    systemPromptVersion: knowledge.systemPromptVersion,
    knowledgeExcerpts: knowledge.knowledgeExcerpts,
    taskKnowledge: knowledge.taskKnowledge,
    knowledgeVersion: knowledge.knowledgeVersion,
    trainee: null,
    allFeedback: [],
    selection: "all",
  });
}
