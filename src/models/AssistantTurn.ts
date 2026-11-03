import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ASSISTANT_TURN_ROLES } from "@/lib/ai/types";

/**
 * One turn in an AssistantConversation — the raw conversation log. It is NOT the
 * source of truth for derived artifacts (those live, versioned, in TraineeAIInsight).
 * `structuredOutput` / `usage` are provider-shaped and stored as Mixed.
 */
const assistantTurnSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "AssistantConversation", required: true, index: true },
    role: { type: String, enum: [...ASSISTANT_TURN_ROLES], required: true },
    /** Optional AITask this turn came from (e.g. "chat"). */
    taskType: { type: String },
    content: { type: String, default: "" },
    structuredOutput: { type: Schema.Types.Mixed },
    provider: { type: String, default: "" },
    model: { type: String, default: "" },
    /** Token/usage bookkeeping when a provider reports it. */
    usage: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

assistantTurnSchema.index({ conversationId: 1, createdAt: 1 });

export type AssistantTurnDoc = InferSchemaType<typeof assistantTurnSchema>;

export const AssistantTurn: Model<AssistantTurnDoc> =
  (models.AssistantTurn as Model<AssistantTurnDoc>) ??
  model<AssistantTurnDoc>("AssistantTurn", assistantTurnSchema);
