import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * One message within a thread. Attachment BINARIES live in MessageAttachment
 * (participant-gated download); here we keep only metadata. `isSystem` marks
 * automated request/system messages.
 */
const attachmentMetaSchema = new Schema(
  {
    attachmentId: { type: Schema.Types.ObjectId, ref: "MessageAttachment", required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

const messageSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "InternalMessageThread", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    body: { type: String, default: "" },
    attachments: { type: [attachmentMetaSchema], default: [] },
    isSystem: { type: Boolean, default: false },
    sentAt: { type: Date, default: Date.now },
    editedAt: { type: Date },
  },
  { timestamps: true },
);

messageSchema.index({ threadId: 1, sentAt: 1 });

export type InternalMessageDoc = InferSchemaType<typeof messageSchema>;

export const InternalMessage: Model<InternalMessageDoc> =
  (models.InternalMessage as Model<InternalMessageDoc>) ??
  model<InternalMessageDoc>("InternalMessage", messageSchema);
