import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_SCOPES } from "@/lib/domain/types";

/**
 * נע״ת / role-play scenario. This is the training-scenario module, NOT system
 * permissions — each scenario defines the role-play roles trainees take on.
 */
const scenarioRoleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    responsibilities: { type: [String], default: [] },
    expectedBehaviors: { type: [String], default: [] },
  },
  { _id: false },
);

const scenarioSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    // Content scope, not a person's course — a scenario may serve "both".
    courseType: { type: String, enum: [...COURSE_SCOPES], required: true },
    description: { type: String, default: "" },
    context: { type: String, default: "" },
    roles: { type: [scenarioRoleSchema], default: [] },
    requiredSkills: { type: [String], default: [] },
    commonChallenges: { type: [String], default: [] },
    evaluationPoints: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type ScenarioDoc = InferSchemaType<typeof scenarioSchema>;

export const Scenario: Model<ScenarioDoc> =
  (models.Scenario as Model<ScenarioDoc>) ?? model<ScenarioDoc>("Scenario", scenarioSchema);
