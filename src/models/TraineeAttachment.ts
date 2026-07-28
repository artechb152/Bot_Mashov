import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_TYPES } from "@/lib/domain/types";

/**
 * A file attached to a trainee profile (previous feedback, notes, documents…).
 * Stored in its own collection (keeps the Trainee doc light, avoids the 16MB
 * document limit). Every attachment belongs to exactly one trainee, one owner
 * (the uploading staff user) AND one course — the same owner+course scope the
 * trainee itself carries, so a document can never be downloaded or deleted from
 * another user's session or another course.
 *
 * The binary lives in `content` (Buffer), size-capped at the route layer.
 */
const traineeAttachmentSchema = new Schema(
  {
    traineeId: { type: Schema.Types.ObjectId, ref: "Trainee", required: true, index: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseType: { type: String, enum: [...COURSE_TYPES], required: true, index: true },
    // Additive denormalized course ref (carried; courseType stays authoritative).
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    content: { type: Buffer, required: true },
    /**
     * Plain text extracted from the file at upload time, when the format allows
     * it (txt/md/csv/json). Empty for formats we do not parse (pdf/docx/images).
     * Nothing reads this yet — it is staged for the future bot, so that documents
     * already on file become usable without a re-upload.
     */
    extractedText: { type: String, default: "" },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type TraineeAttachmentDoc = InferSchemaType<typeof traineeAttachmentSchema>;

export const TraineeAttachment: Model<TraineeAttachmentDoc> =
  (models.TraineeAttachment as Model<TraineeAttachmentDoc>) ??
  model<TraineeAttachmentDoc>("TraineeAttachment", traineeAttachmentSchema);
