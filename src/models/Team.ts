import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A team within a cohort. Belongs to exactly one Cohort; its `courseId` must equal
 * the cohort's course (enforced in the service layer). Team names are unique within
 * a cohort. `isLegacyDefault` marks the bucket the backfill drops pre-hierarchy
 * records into.
 */
const teamSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    cohortId: { type: Schema.Types.ObjectId, ref: "Cohort", required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    isActive: { type: Boolean, required: true, default: true },
    isLegacyDefault: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Team names unique within a cohort.
teamSchema.index({ cohortId: 1, name: 1 }, { unique: true });
teamSchema.index({ isActive: 1 });

export type TeamDoc = InferSchemaType<typeof teamSchema>;

export const Team: Model<TeamDoc> =
  (models.Team as Model<TeamDoc>) ?? model<TeamDoc>("Team", teamSchema);
