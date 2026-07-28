import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { MESSAGE_THREAD_TYPES } from "@/lib/domain/types";

/**
 * An internal message thread. Recipients are resolved to concrete user IDs at send
 * time and frozen in `resolvedRecipientSnapshot` — historical recipients never
 * change when org assignments change later. `participantIds` is the access list:
 * only participants may open the thread.
 */
const threadSchema = new Schema(
  {
    subject: { type: String, required: true, trim: true },
    threadType: { type: String, enum: [...MESSAGE_THREAD_TYPES], required: true, default: "direct" },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    participantIds: { type: [Schema.Types.ObjectId], ref: "User", default: [], index: true },
    resolvedRecipientSnapshot: {
      courseId: { type: Schema.Types.ObjectId, ref: "Course" },
      cohortId: { type: Schema.Types.ObjectId, ref: "Cohort" },
      teamIds: { type: [Schema.Types.ObjectId], ref: "Team", default: undefined },
      recipientUserIds: { type: [Schema.Types.ObjectId], ref: "User", default: undefined },
    },
    relatedTraineeIds: { type: [Schema.Types.ObjectId], ref: "Trainee", default: undefined },
    relatedRequestId: { type: Schema.Types.ObjectId, ref: "AccessRequest" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

threadSchema.index({ lastMessageAt: -1 });
threadSchema.index({ threadType: 1 });

export type InternalMessageThreadDoc = InferSchemaType<typeof threadSchema>;

export const InternalMessageThread: Model<InternalMessageThreadDoc> =
  (models.InternalMessageThread as Model<InternalMessageThreadDoc>) ??
  model<InternalMessageThreadDoc>("InternalMessageThread", threadSchema);
