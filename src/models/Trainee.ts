import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_TYPES } from "@/lib/domain/types";

const traineeSchema = new Schema(
  {
    commanderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    // Legacy/optional: course selection was removed from the product UI. The field
    // is kept (optional) so existing records stay valid; new trainees omit it.
    courseType: { type: String, enum: [...COURSE_TYPES] },
    team: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export type TraineeDoc = InferSchemaType<typeof traineeSchema>;

export const Trainee: Model<TraineeDoc> =
  (models.Trainee as Model<TraineeDoc>) ?? model<TraineeDoc>("Trainee", traineeSchema);
