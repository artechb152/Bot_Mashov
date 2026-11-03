import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Feedback, User } from "@/models";
import { writeAudit } from "@/lib/data/audit";
import { markInsightsStaleForTrainee } from "@/lib/data/ai-insights";
import type { NewFeedbackAttachment } from "@/lib/files/feedback-attachments";
import type { CourseType, FeedbackStatus, FeedbackType } from "@/lib/domain/types";

/**
 * Per-trainee feedback data layer.
 *
 * These functions are UNSCOPED by design: every one of them must be called ONLY
 * after the route has authorized the caller against the trainee via
 * `requireTraineeAccess` (read) / `requireFeedbackWrite` (write). That gate is the
 * single authority; the DTO here never carries secrets. Feedback is chronological
 * (timestamps) and soft-deleted (status), never hard-deleted.
 */

export type FeedbackInput = { feedbackType: FeedbackType; title?: string; rawText: string; selectedAction?: string };

/** Client-safe attachment info — NO storageKey, NO extractedText (server-only). */
export type FeedbackAttachmentDTO = {
  originalFileName: string;
  mimeType: string;
  size: number;
  extractionStatus: string;
  /** Whether extracted text exists (→ the file can serve as an AI source). */
  hasText: boolean;
};

/** What the UI/API expose. NO passwordHash, no storageKey, no raw Mongoose internals. */
export type FeedbackDTO = {
  id: string;
  traineeId: string;
  title: string;
  feedbackType: FeedbackType;
  rawText: string;
  selectedAction: string;
  authorId: string;
  authorName: string;
  status: FeedbackStatus;
  /** Whether this entry is backed by an uploaded file. */
  attachment: FeedbackAttachmentDTO | null;
  createdAt: string | null;
  updatedAt: string | null;
  /** AI-derived fields — empty until the assistant layer fills them (later stage). */
  ai: { summary: string; analysis: string; recommendations: string[] };
};

/** Minimal fields needed to AUTHORIZE an edit/archive by feedback id. */
export type FeedbackMeta = { id: string; traineeId: string; authorId: string; status: FeedbackStatus };

type LeanAttachment = {
  originalFileName?: string;
  mimeType?: string;
  size?: number;
  storageKey?: string;
  extractedText?: string;
  extractionStatus?: string;
};

type LeanFeedback = {
  _id: unknown;
  traineeId?: unknown;
  authorId?: unknown;
  title?: string;
  feedbackType?: string;
  rawText?: string;
  selectedAction?: string;
  attachment?: LeanAttachment | null;
  status?: string;
  aiSummary?: string;
  aiAnalysis?: string;
  aiRecommendations?: string[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

const iso = (v?: Date | string): string | null => (v ? new Date(v).toISOString() : null);

function serializeAttachment(a?: LeanAttachment | null): FeedbackAttachmentDTO | null {
  if (!a || !a.storageKey) return null;
  return {
    originalFileName: a.originalFileName ?? "קובץ",
    mimeType: a.mimeType ?? "application/octet-stream",
    size: typeof a.size === "number" ? a.size : 0,
    extractionStatus: a.extractionStatus ?? "unsupported",
    hasText: Boolean(a.extractedText && a.extractedText.trim()),
  };
}

function serialize(doc: LeanFeedback, authorName: string): FeedbackDTO {
  return {
    id: String(doc._id),
    traineeId: doc.traineeId ? String(doc.traineeId) : "",
    title: doc.title ?? "",
    feedbackType: (doc.feedbackType as FeedbackType) ?? "other",
    rawText: doc.rawText ?? "",
    selectedAction: doc.selectedAction ?? "",
    authorId: doc.authorId ? String(doc.authorId) : "",
    authorName,
    status: (doc.status as FeedbackStatus) ?? "active",
    attachment: serializeAttachment(doc.attachment),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    ai: {
      summary: doc.aiSummary ?? "",
      analysis: doc.aiAnalysis ?? "",
      recommendations: Array.isArray(doc.aiRecommendations) ? doc.aiRecommendations : [],
    },
  };
}

async function authorNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const users = await User.find({ _id: { $in: unique } })
    .select("_id displayName fullName username")
    .lean<{ _id: unknown; displayName?: string; fullName?: string; username?: string }[]>();
  return new Map(users.map((u) => [String(u._id), u.displayName || u.fullName || u.username || ""]));
}

/**
 * List a trainee's feedback, chronological (oldest→newest — matches the AI context
 * + development timeline). Active only unless `includeArchived`. UNSCOPED.
 */
export async function listFeedback(
  traineeId: string,
  opts: { includeArchived?: boolean } = {},
): Promise<FeedbackDTO[]> {
  if (!isValidObjectId(traineeId)) return [];
  await connectToDatabase();
  const q: Record<string, unknown> = { traineeId };
  if (!opts.includeArchived) q.status = "active";
  const docs = await Feedback.find(q).sort({ createdAt: 1, _id: 1 }).lean<LeanFeedback[]>();
  const names = await authorNames(docs.map((d) => (d.authorId ? String(d.authorId) : "")));
  return docs.map((d) => serialize(d, names.get(d.authorId ? String(d.authorId) : "") ?? ""));
}

/** Minimal fields for authorizing an edit/archive by feedback id. UNSCOPED. */
export async function getFeedbackMeta(feedbackId: string): Promise<FeedbackMeta | null> {
  if (!isValidObjectId(feedbackId)) return null;
  await connectToDatabase();
  const doc = await Feedback.findById(feedbackId)
    .select("_id traineeId authorId status")
    .lean<{ _id: unknown; traineeId?: unknown; authorId?: unknown; status?: string } | null>();
  if (!doc) return null;
  return {
    id: String(doc._id),
    traineeId: doc.traineeId ? String(doc.traineeId) : "",
    authorId: doc.authorId ? String(doc.authorId) : "",
    status: (doc.status as FeedbackStatus) ?? "active",
  };
}

/** Create a feedback entry. UNSCOPED — caller passed requireTraineeAccess({write:true}). */
export async function createFeedback(
  traineeId: string,
  ctx: { authorId: string; commanderId: string; courseType: CourseType | null },
  input: FeedbackInput,
  attachment?: NewFeedbackAttachment,
): Promise<FeedbackDTO | null> {
  if (!isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  const doc = await Feedback.create({
    traineeId,
    authorId: ctx.authorId,
    // Denormalized trainee-owner snapshot (required); fall back to the author so the
    // required field is never empty for a legacy trainee with no commander set.
    commanderId: ctx.commanderId || ctx.authorId,
    courseType: ctx.courseType ?? undefined,
    title: input.title?.trim() ?? "",
    feedbackType: input.feedbackType,
    rawText: input.rawText,
    selectedAction: input.selectedAction ?? "",
    // Only metadata + extracted text — never the binary (it lives in storage).
    attachment: attachment
      ? {
          originalFileName: attachment.originalFileName,
          mimeType: attachment.mimeType,
          size: attachment.size,
          storageKey: attachment.storageKey,
          extractedText: attachment.extractedText,
          extractionStatus: attachment.extractionStatus,
          uploadedBy: isValidObjectId(attachment.uploadedBy) ? new Types.ObjectId(attachment.uploadedBy) : undefined,
          uploadedAt: new Date(),
        }
      : undefined,
    status: "active",
  });
  await writeAudit({
    actorId: ctx.authorId,
    action: "feedback.create",
    targetType: "feedback",
    targetId: String(doc._id),
    after: { feedbackType: input.feedbackType, rawTextLength: input.rawText.length, hasFile: Boolean(attachment) },
    metadata: { traineeId },
  });
  // A new source appeared → any current insight for this trainee is now incomplete.
  await markInsightsStaleForTrainee(traineeId);
  const names = await authorNames([ctx.authorId]);
  return serialize(doc.toObject() as LeanFeedback, names.get(ctx.authorId) ?? "");
}

/** Update a feedback entry's content. UNSCOPED — caller authorized via requireFeedbackWrite. */
export async function updateFeedback(
  feedbackId: string,
  input: Partial<FeedbackInput>,
  actorId: string,
): Promise<FeedbackDTO | null> {
  if (!isValidObjectId(feedbackId)) return null;
  await connectToDatabase();
  const update: Record<string, unknown> = {};
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.feedbackType !== undefined) update.feedbackType = input.feedbackType;
  if (input.rawText !== undefined) update.rawText = input.rawText;
  if (input.selectedAction !== undefined) update.selectedAction = input.selectedAction;
  if (Object.keys(update).length === 0) return null;

  const doc = await Feedback.findByIdAndUpdate(feedbackId, { $set: update }, { new: true }).lean<LeanFeedback | null>();
  if (!doc) return null;
  await writeAudit({
    actorId,
    action: "feedback.update",
    targetType: "feedback",
    targetId: feedbackId,
    after: { fields: Object.keys(update) },
  });
  // Its content changed → insights that cite this feedback may be out of date.
  await markInsightsStaleForTrainee(doc.traineeId ? String(doc.traineeId) : "", { changedFeedbackId: feedbackId });
  const names = await authorNames([doc.authorId ? String(doc.authorId) : ""]);
  return serialize(doc, names.get(doc.authorId ? String(doc.authorId) : "") ?? "");
}

/** Archive/restore a feedback entry (soft delete). UNSCOPED — caller authorized. */
export async function setFeedbackStatus(
  feedbackId: string,
  status: FeedbackStatus,
  actorId: string,
): Promise<FeedbackDTO | null> {
  if (!isValidObjectId(feedbackId)) return null;
  await connectToDatabase();
  const update: Record<string, unknown> =
    status === "archived"
      ? { status, archivedAt: new Date(), archivedBy: new Types.ObjectId(actorId) }
      : { status, archivedAt: null, archivedBy: null };
  const doc = await Feedback.findByIdAndUpdate(feedbackId, { $set: update }, { new: true }).lean<LeanFeedback | null>();
  if (!doc) return null;
  await writeAudit({
    actorId,
    action: status === "archived" ? "feedback.archive" : "feedback.restore",
    targetType: "feedback",
    targetId: feedbackId,
  });
  // Archiving/restoring changes the active source set → cite-ing insights may be stale.
  await markInsightsStaleForTrainee(doc.traineeId ? String(doc.traineeId) : "", { changedFeedbackId: feedbackId });
  const names = await authorNames([doc.authorId ? String(doc.authorId) : ""]);
  return serialize(doc, names.get(doc.authorId ? String(doc.authorId) : "") ?? "");
}
