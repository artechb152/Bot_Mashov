import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * An unsent message composition owned by one user. Drafts are private to their
 * author and never resolve recipients or become visible until sent (at which point
 * a thread + message are created and the draft is removed). `recipientSpec` stores
 * the raw selection the user made; it is re-validated + re-resolved at send time.
 */
const draftSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, default: "" },
    body: { type: String, default: "" },
    recipientSpec: { type: Schema.Types.Mixed },
    relatedTraineeIds: { type: [Schema.Types.ObjectId], ref: "Trainee", default: undefined },
  },
  { timestamps: true },
);

export type MessageDraftDoc = InferSchemaType<typeof draftSchema>;

export const MessageDraft: Model<MessageDraftDoc> =
  (models.MessageDraft as Model<MessageDraftDoc>) ??
  model<MessageDraftDoc>("MessageDraft", draftSchema);
