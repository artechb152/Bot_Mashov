import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_TYPES } from "@/lib/domain/types";
import { CONVERSATION_STATUSES } from "@/lib/ai/types";

/**
 * A per-trainee AI conversation, owned by one staff/manager user. Mirrors the
 * trainee scope ({ownerId, courseType}) rather than the multi-participant messaging
 * model. `selectedFeedbackIds` is the conversation's AI source selection (defaults
 * to all active feedback at creation; an explicit empty selection is preserved).
 * Soft-archived only.
 */
const assistantConversationSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    traineeId: { type: Schema.Types.ObjectId, ref: "Trainee", required: true, index: true },
    courseType: { type: String, enum: [...COURSE_TYPES] },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    title: { type: String, default: "" },
    selectedFeedbackIds: { type: [Schema.Types.ObjectId], ref: "Feedback", default: [] },
    status: { type: String, enum: [...CONVERSATION_STATUSES], default: "active", index: true },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// A user's conversations for one trainee, most-recent first.
assistantConversationSchema.index({ ownerId: 1, traineeId: 1, lastMessageAt: -1 });

export type AssistantConversationDoc = InferSchemaType<typeof assistantConversationSchema>;

export const AssistantConversation: Model<AssistantConversationDoc> =
  (models.AssistantConversation as Model<AssistantConversationDoc>) ??
  model<AssistantConversationDoc>("AssistantConversation", assistantConversationSchema);
