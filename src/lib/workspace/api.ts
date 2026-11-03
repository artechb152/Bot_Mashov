/**
 * חונך+ /workspace — browser-side API client (Stage 3).
 *
 * Thin typed wrappers over the Stage 1/2 route handlers. CLIENT-SAFE: every DTO
 * import here is `import type` (erased at build), so no server-only module (mongoose,
 * next/server) is ever bundled into the client. Authorization is NOT done here — the
 * server routes enforce `requireTraineeAccess` / `requireConversationAccess`; these
 * helpers just call them and surface a typed {@link ApiError} (with the HTTP status)
 * so the UI can distinguish 401/403/404 from a real failure.
 */
import type { FeedbackDTO, FeedbackInput } from "@/lib/data/feedback";
import type { InsightDTO } from "@/lib/data/ai-insights";
import type { ConversationDTO, TurnDTO } from "@/lib/data/conversations";
import type {
  AIArtifactTask,
  AIResult,
  ChatOutput,
  FeedbackPolishInput,
  FeedbackPolishOutput,
  AITaskOutput,
} from "@/lib/ai/types";

/** An API failure carrying the HTTP status, so callers can branch on 401/403/404. */
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    });
  } catch {
    throw new ApiError(0, "החיבור לשרת נכשל. בדקו את הרשת ונסו שוב.");
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
        ? (data as { error: string }).error
        : null) ?? "הפעולה נכשלה.";
    throw new ApiError(res.status, message);
  }
  return data as T;
}

const body = (value: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(value) });
const patch = (value: unknown): RequestInit => ({ method: "PATCH", body: JSON.stringify(value) });

/* --- Feedback ------------------------------------------------------------ */

export async function fetchFeedback(traineeId: string, includeArchived = false): Promise<FeedbackDTO[]> {
  const q = includeArchived ? "?includeArchived=1" : "";
  const data = await request<{ feedback: FeedbackDTO[] }>(`/api/trainees/${traineeId}/feedback${q}`);
  return data.feedback;
}

export async function createFeedback(traineeId: string, input: FeedbackInput): Promise<FeedbackDTO> {
  const data = await request<{ feedback: FeedbackDTO }>(`/api/trainees/${traineeId}/feedback`, body(input));
  return data.feedback;
}

/** Create a FILE-based feedback (multipart). The browser sets the multipart boundary,
 *  so this bypasses the JSON `request` helper's Content-Type. */
export async function createFeedbackWithFile(
  traineeId: string,
  fields: { title: string; feedbackType: string; rawText?: string; selectedAction?: string },
  file: File,
): Promise<FeedbackDTO> {
  const form = new FormData();
  form.set("title", fields.title);
  form.set("feedbackType", fields.feedbackType);
  if (fields.rawText) form.set("rawText", fields.rawText);
  if (fields.selectedAction) form.set("selectedAction", fields.selectedAction);
  form.set("file", file);
  let res: Response;
  try {
    res = await fetch(`/api/trainees/${traineeId}/feedback`, { method: "POST", body: form });
  } catch {
    throw new ApiError(0, "החיבור לשרת נכשל. בדקו את הרשת ונסו שוב.");
  }
  const data = (await res.json().catch(() => null)) as { feedback?: FeedbackDTO; error?: string } | null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "העלאת הקובץ נכשלה.");
  return data!.feedback!;
}

export async function updateFeedback(feedbackId: string, input: Partial<FeedbackInput>): Promise<FeedbackDTO> {
  const data = await request<{ feedback: FeedbackDTO }>(`/api/feedback/${feedbackId}`, patch(input));
  return data.feedback;
}

export async function archiveFeedback(feedbackId: string): Promise<FeedbackDTO> {
  const data = await request<{ feedback: FeedbackDTO }>(`/api/feedback/${feedbackId}/archive`, { method: "POST" });
  return data.feedback;
}

export async function restoreFeedback(feedbackId: string): Promise<FeedbackDTO> {
  const data = await request<{ feedback: FeedbackDTO }>(`/api/feedback/${feedbackId}/restore`, { method: "POST" });
  return data.feedback;
}

/* --- Insights ------------------------------------------------------------ */

export async function fetchInsights(traineeId: string, type?: AIArtifactTask): Promise<InsightDTO[]> {
  const q = type ? `?type=${encodeURIComponent(type)}` : "";
  const data = await request<{ insights: InsightDTO[] }>(`/api/trainees/${traineeId}/insights${q}`);
  return data.insights;
}

/* --- Conversations ------------------------------------------------------- */

export async function fetchConversations(traineeId: string, includeArchived = false): Promise<ConversationDTO[]> {
  const q = new URLSearchParams({ traineeId });
  if (includeArchived) q.set("includeArchived", "1");
  const data = await request<{ conversations: ConversationDTO[] }>(`/api/ai/conversations?${q.toString()}`);
  return data.conversations;
}

export async function createConversation(traineeId: string, title?: string): Promise<ConversationDTO> {
  const data = await request<{ conversation: ConversationDTO }>(`/api/ai/conversations`, body({ traineeId, title }));
  return data.conversation;
}

export async function fetchConversation(
  conversationId: string,
): Promise<{ conversation: ConversationDTO; turns: TurnDTO[] }> {
  return request(`/api/ai/conversations/${conversationId}`);
}

export async function updateConversation(
  conversationId: string,
  input: { title?: string; selectedFeedbackIds?: string[] },
): Promise<ConversationDTO> {
  const data = await request<{ conversation: ConversationDTO }>(`/api/ai/conversations/${conversationId}`, patch(input));
  return data.conversation;
}

export async function archiveConversation(conversationId: string): Promise<ConversationDTO> {
  const data = await request<{ conversation: ConversationDTO }>(
    `/api/ai/conversations/${conversationId}/archive`,
    { method: "POST" },
  );
  return data.conversation;
}

export async function restoreConversation(conversationId: string): Promise<ConversationDTO> {
  const data = await request<{ conversation: ConversationDTO }>(
    `/api/ai/conversations/${conversationId}/restore`,
    { method: "POST" },
  );
  return data.conversation;
}

/* --- AI runs ------------------------------------------------------------- */

export type SendMessageResult = {
  result: AIResult<ChatOutput>;
  userTurn: TurnDTO | null;
  assistantTurn: TurnDTO | null;
  sourceCount: number;
};

export async function sendMessage(conversationId: string, content: string): Promise<SendMessageResult> {
  return request(`/api/ai/conversations/${conversationId}/messages`, body({ content }));
}

export type RunTaskResult<T extends AIArtifactTask> = {
  result: AIResult<AITaskOutput<T>>;
  insight: InsightDTO | null;
  sourceCount: number;
};

/** Run a structured artifact task (review/timeline/next-focus/summary) for a trainee. */
export async function runArtifactTask<T extends AIArtifactTask>(
  task: T,
  args: { traineeId: string; conversationId?: string | null; selectedFeedbackIds?: string[] },
): Promise<RunTaskResult<T>> {
  return request(`/api/ai/tasks/${task}`, body({
    traineeId: args.traineeId,
    conversationId: args.conversationId ?? undefined,
    selectedFeedbackIds: args.selectedFeedbackIds,
  }));
}

export type PolishResult = {
  result: AIResult<FeedbackPolishOutput>;
  sourceCount: number;
};

/** Run feedback_polish (raw notes → professional draft). NOT persisted — the user
 *  must explicitly save the returned draft as feedback. */
export async function polishFeedback(traineeId: string, input: FeedbackPolishInput): Promise<PolishResult> {
  return request(`/api/ai/tasks/feedback_polish`, body({ traineeId, input }));
}

/* --- Preferences --------------------------------------------------------- */

/** Persist the caller's personal default cohort (the one /workspace opens on). */
export async function setDefaultCohort(cohortId: string): Promise<void> {
  await request(`/api/settings/default-cohort`, { method: "PATCH", body: JSON.stringify({ cohortId }) });
}
