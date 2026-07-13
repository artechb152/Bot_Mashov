import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A file attached to a trainee profile (previous feedback, notes, documents…).
 * Stored in its own collection (keeps the Trainee doc light, avoids the 16MB
 * document limit). Every attachment belongs to exactly one trainee AND one
 * owner (the uploading staff user) — both are indexed for owner-scoped queries.
 * The binary lives in `content` (Buffer); this model is future-AI-ready.
 */
const traineeAttachmentSchema = new Schema(
  {
    traineeId: { type: Schema.Types.ObjectId, ref: "Trainee", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    content: { type: Buffer, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type TraineeAttachmentDoc = InferSchemaType<typeof traineeAttachmentSchema>;

export const TraineeAttachment: Model<TraineeAttachmentDoc> =
  (models.TraineeAttachment as Model<TraineeAttachmentDoc>) ??
  model<TraineeAttachmentDoc>("TraineeAttachment", traineeAttachmentSchema);
