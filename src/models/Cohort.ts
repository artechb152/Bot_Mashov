import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COHORT_STATUSES } from "@/lib/domain/types";

/**
 * A cohort — one cycle of a course. Belongs to exactly one Course. Archiving is a
 * status change (archived cohorts remain accessible; no separate collection).
 * `isLocked` is DEPRECATED — the cohort edit-freeze feature was removed; the field
 * is kept for backward compatibility but is no longer written or used to block
 * editing. `isLegacyDefault` marks the bucket the backfill script drops
 * pre-hierarchy records into.
 */
const cohortSchema = new Schema(
  {
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Optional stable code within a course. Reserved value "__legacy__" is used by
    // the backfill bucket. Partial-unique per course (only when a string is set).
    code: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, enum: [...COHORT_STATUSES], required: true, default: "planned" },
    isLocked: { type: Boolean, required: true, default: false },
    isLegacyDefault: { type: Boolean, required: true, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

cohortSchema.index(
  { courseId: 1, code: 1 },
  { unique: true, partialFilterExpression: { code: { $type: "string" } } },
);
cohortSchema.index({ courseId: 1, status: 1 });
cohortSchema.index({ startDate: 1 });
cohortSchema.index({ endDate: 1 });

export type CohortDoc = InferSchemaType<typeof cohortSchema>;

export const Cohort: Model<CohortDoc> =
  (models.Cohort as Model<CohortDoc>) ?? model<CohortDoc>("Cohort", cohortSchema);
