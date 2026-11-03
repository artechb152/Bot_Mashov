import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { AI_ARTIFACT_TASKS, INSIGHT_STATUSES } from "@/lib/ai/types";

/**
 * A versioned, traceable AI artifact for a trainee (review / timeline / next-focus /
 * feedback-summary). Never overwritten: producing a new artifact of a type marks the
 * previous one `superseded`; changing a source feedback marks referencing artifacts
 * `stale`. Records exactly which feedback + which prompt/knowledge versions produced
 * it (`sourceFeedbackIds`, `contextHash`, `systemPromptVersion`, `knowledgeVersion`)
 * for full traceability and staleness detection.
 */
const traineeAIInsightSchema = new Schema(
  {
    traineeId: { type: Schema.Types.ObjectId, ref: "Trainee", required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    conversationId: { type: Schema.Types.ObjectId, ref: "AssistantConversation" },
    artifactType: { type: String, enum: [...AI_ARTIFACT_TASKS], required: true },
    sourceFeedbackIds: { type: [Schema.Types.ObjectId], ref: "Feedback", default: [] },
    structuredOutput: { type: Schema.Types.Mixed },
    contextHash: { type: String, default: "" },
    provider: { type: String, default: "" },
    model: { type: String, default: "" },
    systemPromptVersion: { type: String, default: "" },
    knowledgeVersion: { type: String, default: "" },
    status: { type: String, enum: [...INSIGHT_STATUSES], default: "current", index: true },
    staleAt: { type: Date },
  },
  { timestamps: true },
);

// Latest artifact per (trainee, type, status).
traineeAIInsightSchema.index({ traineeId: 1, artifactType: 1, status: 1, createdAt: -1 });

export type TraineeAIInsightDoc = InferSchemaType<typeof traineeAIInsightSchema>;

export const TraineeAIInsight: Model<TraineeAIInsightDoc> =
  (models.TraineeAIInsight as Model<TraineeAIInsightDoc>) ??
  model<TraineeAIInsightDoc>("TraineeAIInsight", traineeAIInsightSchema);
