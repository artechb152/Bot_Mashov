import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_TYPES, TRAINEE_STATUSES } from "@/lib/domain/types";

/**
 * A trainee file. Ownership is anchored on `commanderId` (THE canonical owner,
 * load-bearing in the scoped query filter and the compound index). `courseType`
 * remains the authoritative scope key. The org/ownership fields below are ADDITIVE
 * and optional so pre-redesign records still validate:
 *
 *   - ownerId          : denormalized mirror of commanderId (kept equal).
 *   - originalOwnerId  : the first owner, preserved across transfers.
 *   - createdBy / lastUpdatedBy : audit trail.
 *   - courseId/cohortId/teamId  : org placement (courseType stays authoritative).
 *   - status           : active | archived (archive is a status, not deletion).
 *   - cohortLocked     : DEPRECATED. The cohort edit-freeze feature was removed; this
 *                        field is kept for backward compatibility but is no longer
 *                        written or used to block editing.
 *
 * Both commanderId + courseType together still form the staff authorization scope:
 * every staff read/write filters on the pair, so a trainee is unreachable from
 * another user's session or another course.
 */
const traineeSchema = new Schema(
  {
    commanderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fullName: { type: String, required: true, trim: true },
    courseType: { type: String, enum: [...COURSE_TYPES], required: true, index: true },
    team: { type: String, default: "" },
    strengths: { type: [String], default: [] },
    weaknesses: { type: [String], default: [] },
    notes: { type: String, default: "" },

    // Additive org + ownership fields.
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    originalOwnerId: { type: Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastUpdatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    cohortId: { type: Schema.Types.ObjectId, ref: "Cohort" },
    teamId: { type: Schema.Types.ObjectId, ref: "Team" },
    status: { type: String, enum: [...TRAINEE_STATUSES], required: true, default: "active" },
    cohortLocked: { type: Boolean, required: true, default: false },

    // Optional traceability for a trainee created via file import. The trainee record
    // is the primary datum; this only references the source file. The BINARY is NOT
    // stored here — it lives in FileStorage under `storageKey` (server-side only, never
    // exposed to the client). Additive + optional so existing records still validate.
    sourceImport: {
      type: new Schema(
        {
          originalFileName: { type: String, default: "" },
          mimeType: { type: String, default: "" },
          size: { type: Number, default: 0 },
          storageKey: { type: String, default: "" },
          extractionStatus: { type: String, default: "" },
          uploadedBy: { type: Schema.Types.ObjectId, ref: "User" },
          uploadedAt: { type: Date },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { timestamps: true },
);

// The exact shape of every scoped staff query — owner + course, newest first.
traineeSchema.index({ commanderId: 1, courseType: 1, createdAt: -1 });
// Org/ownership access paths (admin course-scoped, staff-by-cohort facets).
traineeSchema.index({ ownerId: 1, cohortId: 1 });
traineeSchema.index({ courseId: 1, cohortId: 1 });
traineeSchema.index({ courseId: 1, teamId: 1 });
traineeSchema.index({ status: 1 });
traineeSchema.index({ updatedAt: -1 });

export type TraineeDoc = InferSchemaType<typeof traineeSchema>;

export const Trainee: Model<TraineeDoc> =
  (models.Trainee as Model<TraineeDoc>) ?? model<TraineeDoc>("Trainee", traineeSchema);
