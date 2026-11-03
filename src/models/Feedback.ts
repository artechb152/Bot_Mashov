import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_TYPES, FEEDBACK_STATUSES, FEEDBACK_TYPES } from "@/lib/domain/types";

/**
 * A single per-trainee feedback entry (chronological via timestamps). Each entry
 * can serve as an AI source (selection is per-conversation, later stage) and its
 * AI-derived fields are filled by the assistant layer.
 *
 * Ownership / authorship (see the redesign plan §4):
 *   - `authorId`     — the staff member who WROTE this entry. Several staff may add
 *                      feedback to the same trainee, so authorship is explicit and
 *                      edit permission keys off it (plus trainee access).
 *   - `commanderId`  — a denormalized snapshot of the TRAINEE's owner at creation
 *                      time (from Trainee.commanderId). Kept for scope/consistency;
 *                      authorization is NOT decided by it — it is decided by
 *                      `requireTraineeAccess(traineeId)` on the live trainee.
 *   - `courseType`   — denormalized course scope (from the trainee), like attachments.
 *
 * Soft delete only: archiving sets `status: "archived"` (never a hard delete), so
 * feedback, its history, and any derived AI artifacts are preserved.
 */
const feedbackSchema = new Schema(
  {
    traineeId: { type: Schema.Types.ObjectId, ref: "Trainee", required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Denormalized trainee-owner snapshot (scope/consistency only — never authz).
    commanderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseType: { type: String, enum: [...COURSE_TYPES] },

    // Short human title for the entry (e.g. "התנסות הדרכה ראשונה"). Optional for
    // backward compatibility with pre-title rows; required by the new composer.
    title: { type: String, default: "" },
    feedbackType: { type: String, enum: [...FEEDBACK_TYPES], required: true },
    rawText: { type: String, default: "" },
    selectedAction: { type: String, default: "" },

    // Optional file attachment. The BINARY is NEVER stored here — only metadata +
    // the server-extracted text (used as the AI source when rawText is empty). The
    // bytes live in the storage backend under `attachment.storageKey`.
    attachment: {
      type: new Schema(
        {
          originalFileName: { type: String, required: true },
          mimeType: { type: String, required: true },
          size: { type: Number, required: true },
          storageKey: { type: String, required: true },
          extractedText: { type: String, default: "" },
          extractionStatus: { type: String, default: "unsupported" },
          uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
          uploadedAt: { type: Date, default: Date.now },
        },
        { _id: false },
      ),
      default: undefined,
    },

    status: { type: String, enum: [...FEEDBACK_STATUSES], default: "active", index: true },
    archivedAt: { type: Date },
    archivedBy: { type: Schema.Types.ObjectId, ref: "User" },

    // AI fields — populated later by the assistant layer (not connected yet).
    aiSummary: { type: String, default: "" },
    aiAnalysis: { type: String, default: "" },
    aiRecommendations: { type: [String], default: [] },
  },
  { timestamps: true },
);

// Primary listing: a trainee's feedback by status, in chronological order.
feedbackSchema.index({ traineeId: 1, status: 1, createdAt: 1 });

export type FeedbackDoc = InferSchemaType<typeof feedbackSchema>;

export const Feedback: Model<FeedbackDoc> =
  (models.Feedback as Model<FeedbackDoc>) ?? model<FeedbackDoc>("Feedback", feedbackSchema);
