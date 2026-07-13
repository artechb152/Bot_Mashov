import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { FEEDBACK_TYPES } from "@/lib/domain/types";

const feedbackSchema = new Schema(
  {
    commanderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    traineeId: { type: Schema.Types.ObjectId, ref: "Trainee", required: true, index: true },
    feedbackType: { type: String, enum: [...FEEDBACK_TYPES], required: true },
    rawText: { type: String, default: "" },
    selectedAction: { type: String, default: "" },
    // AI fields — populated later by the mock/real assistant layer (not connected yet).
    aiSummary: { type: String, default: "" },
    aiAnalysis: { type: String, default: "" },
    aiRecommendations: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type FeedbackDoc = InferSchemaType<typeof feedbackSchema>;

export const Feedback: Model<FeedbackDoc> =
  (models.Feedback as Model<FeedbackDoc>) ?? model<FeedbackDoc>("Feedback", feedbackSchema);
