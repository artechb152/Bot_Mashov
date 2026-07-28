import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Per-user state for a thread: read/archived/starred/deleted flags. Archiving and
 * deleting are PER USER — they never affect the thread for other participants.
 */
const stateSchema = new Schema(
  {
    threadId: { type: Schema.Types.ObjectId, ref: "InternalMessageThread", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date },
    archivedAt: { type: Date },
    starredAt: { type: Date },
    deletedForUserAt: { type: Date },
  },
  { timestamps: true },
);

stateSchema.index({ threadId: 1, userId: 1 }, { unique: true });
stateSchema.index({ userId: 1, readAt: 1 });
stateSchema.index({ userId: 1, archivedAt: 1 });

export type ThreadParticipantStateDoc = InferSchemaType<typeof stateSchema>;

export const ThreadParticipantState: Model<ThreadParticipantStateDoc> =
  (models.ThreadParticipantState as Model<ThreadParticipantStateDoc>) ??
  model<ThreadParticipantStateDoc>("ThreadParticipantState", stateSchema);
