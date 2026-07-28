import { getCourseConfig, type CourseConfig } from "@/lib/course/courseConfig";
import { getTrainee, type TraineeDTO } from "@/lib/data/trainees";
import { listAttachments, type AttachmentDTO } from "@/lib/data/attachments";
import type { OwnerScope } from "@/lib/data/scope";
import type { CourseType } from "@/lib/domain/types";

/**
 * Everything the FUTURE assistant will need in order to answer, assembled in one
 * owner+course-scoped place.
 *
 * NOTHING here is wired to any AI or external API. Like `getSystemPrompt()` in
 * `./prompts.ts`, this is a staged seam that the running app does not import yet:
 * the chat UI is still local-only. It exists so that when a bot endpoint is
 * added, it has exactly one function to call — and cannot accidentally be given
 * a trainee or a document belonging to another user or another course, because
 * the scope is threaded through every lookup below.
 *
 * Server-only (touches the data layer).
 */
export type AssistantContext = {
  /** The course of the staff user asking — drives all course-specific behaviour. */
  courseType: CourseType;
  /** Per-course labels//instructions/knowledge scopes (see lib/course/courseConfig.ts). */
  courseConfig: CourseConfig;
  /** The trainee linked to the conversation, if any. Null = a general consult. */
  trainee: TraineeDTO | null;
  /** Metadata for that trainee's documents (never the binaries). */
  traineeDocuments: AttachmentDTO[];
};

/**
 * Build the assistant context for a conversation.
 *
 * `traineeId` is untrusted — it comes from a query param or a client selection —
 * so it is resolved through the scoped data layer. An id belonging to someone
 * else, or to the other course, yields `null` rather than throwing, which is why
 * linking a foreign trainee is a no-op rather than a leak.
 */
export async function buildAssistantContext(
  scope: OwnerScope,
  traineeId?: string | null,
): Promise<AssistantContext> {
  const courseConfig = getCourseConfig(scope.courseType);

  const trainee = traineeId ? await getTrainee(traineeId, scope) : null;
  const traineeDocuments = trainee ? await listAttachments(trainee.id, scope) : [];

  return {
    courseType: scope.courseType,
    courseConfig,
    trainee,
    traineeDocuments,
  };
}
