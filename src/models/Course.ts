import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_TYPES } from "@/lib/domain/types";

/**
 * A course the product serves. `code` IS the existing CourseType enum value
 * (kapeh|maksim), so courseType and courseId map deterministically — the bridge
 * that lets the org hierarchy layer on without a big-bang cutover. Seeded
 * idempotently via `ensureCourses()` (upsert on the unique `code`); running it
 * repeatedly never creates duplicates and never resets an existing course.
 */
const courseSchema = new Schema(
  {
    code: { type: String, enum: [...COURSE_TYPES], required: true, unique: true },
    name: { type: String, required: true, trim: true },
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export type CourseDoc = InferSchemaType<typeof courseSchema>;

export const Course: Model<CourseDoc> =
  (models.Course as Model<CourseDoc>) ?? model<CourseDoc>("Course", courseSchema);
