import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ADMIN_POSITIONS, USER_ROLES } from "@/lib/domain/types";

/**
 * A user's organizational assignment over time. This is an APPEND-mostly history:
 * when a staff user moves team/cohort, the old `isCurrent` row is closed
 * (`isCurrent: false`, `endedAt` set) and a new current row is created — old rows
 * are never deleted. A user has at most one current assignment (partial-unique
 * index below). Admins belong to a course but normally no staff team; super-admins
 * need no course assignment.
 */
const userAssignmentSchema = new Schema(
  {
    // Indexes for userId are declared explicitly below (partial-unique on the
    // current assignment + a compound) — no field-level `index` to avoid a dupe.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    cohortId: { type: Schema.Types.ObjectId, ref: "Cohort" },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    assignmentType: {
      type: String,
      enum: ["staff_team", "course_admin"],
      required: true,
    },
    // Snapshot of the role/position at assignment time (for history readability).
    role: { type: String, enum: [...USER_ROLES] },
    adminPosition: { type: String, enum: [...ADMIN_POSITIONS] },
    isCurrent: { type: Boolean, required: true, default: true },
    startedAt: { type: Date, required: true, default: Date.now },
    endedAt: { type: Date },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// At most one current assignment per user (partial-unique on isCurrent:true).
userAssignmentSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } },
);
userAssignmentSchema.index({ courseId: 1, cohortId: 1, teamId: 1 });
userAssignmentSchema.index({ userId: 1, isCurrent: 1 });

export type UserAssignmentDoc = InferSchemaType<typeof userAssignmentSchema>;

export const UserAssignment: Model<UserAssignmentDoc> =
  (models.UserAssignment as Model<UserAssignmentDoc>) ??
  model<UserAssignmentDoc>("UserAssignment", userAssignmentSchema);
