import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AssistantConversation, AssistantTurn, Feedback } from "@/models";
import { allActiveIds, sanitizeSelection, selectFeedbackForAI, type FeedbackForSelection } from "@/lib/ai/selection";
import type { FeedbackSelection } from "@/lib/ai/context";
import type { AITask, AIFeedbackItem, AssistantTurnRole, ConversationStatus } from "@/lib/ai/types";
import type { CourseType } from "@/lib/domain/types";

/**
 * Per-trainee AI conversation data layer. UNSCOPED — every function must be called
 * only after the route authorizes the caller (`requireTraineeAccess` +
 * `requireConversationAccess`). Source selection is persisted per conversation; the
 * context feedback is always RE-LOADED fresh from the DB (active + belonging), never
 * trusted from the client.
 */

export type ConversationDTO = {
  id: string;
  traineeId: string;
  ownerId: string;
  title: string;
  selectedFeedbackIds: string[];
  status: ConversationStatus;
  lastMessageAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ConversationMeta = { id: string; traineeId: string; ownerId: string; status: ConversationStatus };

export type TurnInput = {
  role: AssistantTurnRole;
  content: string;
  taskType?: AITask;
  structuredOutput?: unknown;
  provider?: string;
  model?: string;
  usage?: unknown;
};

export type TurnDTO = {
  id: string;
  role: AssistantTurnRole;
  taskType: string | null;
  content: string;
  structuredOutput: unknown;
  provider: string;
  model: string;
  createdAt: string | null;
};

const iso = (v?: Date | string | null): string | null => (v ? new Date(v).toISOString() : null);
const idStrings = (arr?: unknown[]): string[] => (Array.isArray(arr) ? arr.map((x) => String(x)) : []);

type LeanConversation = {
  _id: unknown;
  traineeId?: unknown;
  ownerId?: unknown;
  title?: string;
  selectedFeedbackIds?: unknown[];
  status?: string;
  lastMessageAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function serializeConversation(doc: LeanConversation): ConversationDTO {
  return {
    id: String(doc._id),
    traineeId: doc.traineeId ? String(doc.traineeId) : "",
    ownerId: doc.ownerId ? String(doc.ownerId) : "",
    title: doc.title ?? "",
    selectedFeedbackIds: idStrings(doc.selectedFeedbackIds),
    status: (doc.status as ConversationStatus) ?? "active",
    lastMessageAt: iso(doc.lastMessageAt),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

type LeanTurn = {
  _id: unknown;
  role?: string;
  taskType?: string;
  content?: string;
  structuredOutput?: unknown;
  provider?: string;
  model?: string;
  createdAt?: Date | string;
};

function serializeTurn(doc: LeanTurn): TurnDTO {
  return {
    id: String(doc._id),
    role: (doc.role as AssistantTurnRole) ?? "user",
    taskType: doc.taskType ?? null,
    content: doc.content ?? "",
    structuredOutput: doc.structuredOutput ?? null,
    provider: doc.provider ?? "",
    model: doc.model ?? "",
    createdAt: iso(doc.createdAt),
  };
}

/** Load a trainee's feedback (any status) shaped for selection. UNSCOPED. */
async function loadFeedbackForSelection(traineeId: string): Promise<FeedbackForSelection[]> {
  const docs = await Feedback.find({ traineeId })
    .select("_id feedbackType rawText selectedAction status createdAt updatedAt attachment.extractedText")
    .sort({ createdAt: 1, _id: 1 })
    .lean<
      {
        _id: unknown;
        feedbackType?: string;
        rawText?: string;
        selectedAction?: string;
        status?: string;
        createdAt?: Date | string;
        updatedAt?: Date | string;
        attachment?: { extractedText?: string } | null;
      }[]
    >();
  return docs.map((d) => ({
    id: String(d._id),
    feedbackType: (d.feedbackType as FeedbackForSelection["feedbackType"]) ?? "other",
    // For a file-based feedback the AI source is the EXTRACTED TEXT (never the binary);
    // a text feedback uses its rawText. Empty when a file has no extractable text.
    rawText: (d.rawText && d.rawText.trim()) ? d.rawText : (d.attachment?.extractedText ?? ""),
    selectedAction: d.selectedAction ?? "",
    createdAt: iso(d.createdAt) ?? "",
    updatedAt: iso(d.updatedAt) ?? undefined,
    status: (d.status as FeedbackForSelection["status"]) ?? "active",
  }));
}

/**
 * The context feedback for an AI call on a conversation: RE-LOADED fresh, then
 * narrowed to ACTIVE + SELECTED (client ids are never trusted). Returns [] for an
 * empty selection — the caller handles the empty-context case explicitly.
 */
export async function loadContextFeedback(
  traineeId: string,
  selection: FeedbackSelection,
): Promise<AIFeedbackItem[]> {
  if (!isValidObjectId(traineeId)) return [];
  await connectToDatabase();
  const items = await loadFeedbackForSelection(traineeId);
  // Drop entries with no usable text (e.g. a file whose text could not be extracted):
  // the binary never enters the context, and an empty source adds nothing.
  return selectFeedbackForAI(items, selection).filter((f) => f.rawText.trim().length > 0);
}

export async function listConversations(
  traineeId: string,
  ownerId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<ConversationDTO[]> {
  if (!isValidObjectId(traineeId) || !isValidObjectId(ownerId)) return [];
  await connectToDatabase();
  const q: Record<string, unknown> = { traineeId, ownerId };
  if (!opts.includeArchived) q.status = "active";
  const docs = await AssistantConversation.find(q).sort({ lastMessageAt: -1, _id: -1 }).lean<LeanConversation[]>();
  return docs.map(serializeConversation);
}

export async function getConversationMeta(conversationId: string): Promise<ConversationMeta | null> {
  if (!isValidObjectId(conversationId)) return null;
  await connectToDatabase();
  const doc = await AssistantConversation.findById(conversationId)
    .select("_id traineeId ownerId status")
    .lean<{ _id: unknown; traineeId?: unknown; ownerId?: unknown; status?: string } | null>();
  if (!doc) return null;
  return {
    id: String(doc._id),
    traineeId: doc.traineeId ? String(doc.traineeId) : "",
    ownerId: doc.ownerId ? String(doc.ownerId) : "",
    status: (doc.status as ConversationStatus) ?? "active",
  };
}

export async function getConversation(conversationId: string): Promise<ConversationDTO | null> {
  if (!isValidObjectId(conversationId)) return null;
  await connectToDatabase();
  const doc = await AssistantConversation.findById(conversationId).lean<LeanConversation | null>();
  return doc ? serializeConversation(doc) : null;
}

/** Create a conversation. Default source selection = all ACTIVE feedback of the trainee. */
export async function createConversation(
  traineeId: string,
  ctx: { ownerId: string; courseType: CourseType | null; courseId?: string | null },
  input: { title?: string } = {},
): Promise<ConversationDTO | null> {
  if (!isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  const items = await loadFeedbackForSelection(traineeId);
  const defaultIds = allActiveIds(items).map((id) => new Types.ObjectId(id));
  const doc = await AssistantConversation.create({
    traineeId,
    ownerId: ctx.ownerId,
    createdBy: ctx.ownerId,
    courseType: ctx.courseType ?? undefined,
    courseId: ctx.courseId && isValidObjectId(ctx.courseId) ? new Types.ObjectId(ctx.courseId) : undefined,
    title: input.title?.trim() || "שיחה חדשה",
    selectedFeedbackIds: defaultIds,
    status: "active",
    lastMessageAt: new Date(),
  });
  return serializeConversation(doc.toObject() as LeanConversation);
}

/**
 * Update title and/or source selection. A provided `selectedFeedbackIds` is
 * SANITIZED to the trainee's own feedback (cross-trainee/unknown ids dropped); an
 * explicit empty selection is preserved as empty (never reset to "all").
 */
export async function updateConversation(
  conversationId: string,
  traineeId: string,
  input: { title?: string; selectedFeedbackIds?: string[] },
): Promise<ConversationDTO | null> {
  if (!isValidObjectId(conversationId)) return null;
  await connectToDatabase();
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.selectedFeedbackIds !== undefined) {
    const items = await loadFeedbackForSelection(traineeId);
    const clean = sanitizeSelection(input.selectedFeedbackIds, items);
    update.selectedFeedbackIds = clean.map((id) => new Types.ObjectId(id));
  }
  if (Object.keys(update).length === 0) return null;
  const doc = await AssistantConversation.findByIdAndUpdate(conversationId, { $set: update }, { new: true }).lean<LeanConversation | null>();
  return doc ? serializeConversation(doc) : null;
}

export async function setConversationStatus(
  conversationId: string,
  status: ConversationStatus,
): Promise<ConversationDTO | null> {
  if (!isValidObjectId(conversationId)) return null;
  await connectToDatabase();
  const doc = await AssistantConversation.findByIdAndUpdate(conversationId, { $set: { status } }, { new: true }).lean<LeanConversation | null>();
  return doc ? serializeConversation(doc) : null;
}

export async function listTurns(conversationId: string): Promise<TurnDTO[]> {
  if (!isValidObjectId(conversationId)) return [];
  await connectToDatabase();
  const docs = await AssistantTurn.find({ conversationId }).sort({ createdAt: 1, _id: 1 }).lean<LeanTurn[]>();
  return docs.map(serializeTurn);
}

/** Append a turn and bump the conversation's lastMessageAt. */
export async function addTurn(conversationId: string, turn: TurnInput): Promise<TurnDTO | null> {
  if (!isValidObjectId(conversationId)) return null;
  await connectToDatabase();
  const doc = await AssistantTurn.create({
    conversationId,
    role: turn.role,
    taskType: turn.taskType,
    content: turn.content,
    structuredOutput: turn.structuredOutput,
    provider: turn.provider ?? "",
    model: turn.model ?? "",
    usage: turn.usage,
  });
  await AssistantConversation.findByIdAndUpdate(conversationId, { $set: { lastMessageAt: new Date() } });
  return serializeTurn(doc.toObject() as LeanTurn);
}
