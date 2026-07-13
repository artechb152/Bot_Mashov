import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const feedbackEntrySchema = new Schema(
  {
    writerTraineeId: { type: Schema.Types.ObjectId, ref: "Trainee" },
    targetTraineeId: { type: Schema.Types.ObjectId, ref: "Trainee" },
    roleInScenario: { type: String, default: "" },
    rawFeedback: { type: String, default: "" },
    // Mock "feedback on feedback" — filled by the mock AI layer later (not connected yet).
    mockAiFeedbackOnFeedback: { type: String, default: "" },
  },
  { _id: false },
);

const finalExerciseSchema = new Schema(
  {
    commanderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    groupName: { type: String, default: "" },
    traineeIds: { type: [Schema.Types.ObjectId], ref: "Trainee", default: [] },
    scenarioTitle: { type: String, default: "" },
    feedbackEntries: { type: [feedbackEntrySchema], default: [] },
  },
  { timestamps: true },
);

export type FinalExerciseDoc = InferSchemaType<typeof finalExerciseSchema>;

export const FinalExercise: Model<FinalExerciseDoc> =
  (models.FinalExercise as Model<FinalExerciseDoc>) ??
  model<FinalExerciseDoc>("FinalExercise", finalExerciseSchema);
