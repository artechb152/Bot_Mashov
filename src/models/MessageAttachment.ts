import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A message attachment binary, kept separate from trainee documents. Download and
 * deletion are gated by THREAD PARTICIPATION at the route layer. Stored as a Buffer
 * in Mongo (same pattern as TraineeAttachment; no filesystem → no path traversal).
 */
const messageAttachmentSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "InternalMessageThread", required: true, index: true },
    messageId: { type: Schema.Types.ObjectId, ref: "InternalMessage" },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    content: { type: Buffer, required: true },
  },
  { timestamps: true },
);

export type MessageAttachmentDoc = InferSchemaType<typeof messageAttachmentSchema>;

export const MessageAttachment: Model<MessageAttachmentDoc> =
  (models.MessageAttachment as Model<MessageAttachmentDoc>) ??
  model<MessageAttachmentDoc>("MessageAttachment", messageAttachmentSchema);
