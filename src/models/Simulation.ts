import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_SCOPES, DIFFICULTIES } from "@/lib/domain/types";

const simulationSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    // Content scope, not a person's course — a simulation may serve "both".
    courseType: { type: String, enum: [...COURSE_SCOPES], required: true },
    skills: { type: [String], default: [] },
    difficulty: { type: String, enum: [...DIFFICULTIES], default: "medium" },
    description: { type: String, default: "" },
    roles: { type: [String], default: [] },
    evaluationPoints: { type: [String], default: [] },
    recommendedForWeaknesses: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type SimulationDoc = InferSchemaType<typeof simulationSchema>;

export const Simulation: Model<SimulationDoc> =
  (models.Simulation as Model<SimulationDoc>) ?? model<SimulationDoc>("Simulation", simulationSchema);
