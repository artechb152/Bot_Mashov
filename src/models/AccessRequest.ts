import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ACCESS_REQUEST_STATUSES, ACCESS_REQUEST_TYPES } from "@/lib/domain/types";

/**
 * A typed access request. Reviewers are chosen by the SERVER (never the browser).
 * A cooldown after rejection/cancellation and a one-open-per-(type,requester,target)
 * rule prevent spam. Every status change is audited + notified.
 */
const accessRequestSchema = new Schema(
  {
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    requestType: { type: String, enum: [...ACCESS_REQUEST_TYPES], required: true },

    targetUserId: { type: Schema.Types.ObjectId, ref: "User" },
    targetTraineeId: { type: Schema.Types.ObjectId, ref: "Trainee" },
    targetCourseId: { type: Schema.Types.ObjectId, ref: "Course" },
    targetCohortId: { type: Schema.Types.ObjectId, ref: "Cohort" },
    targetTeamId: { type: Schema.Types.ObjectId, ref: "Team" },
    // Extra typed payload (e.g. requested admin position, permission level).
    payload: { type: Schema.Types.Mixed },

    reason: { type: String, required: true },
    status: { type: String, enum: [...ACCESS_REQUEST_STATUSES], required: true, default: "pending", index: true },

    assignedReviewerIds: { type: [Schema.Types.ObjectId], ref: "User", default: [], index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewNote: { type: String },

    threadId: { type: Schema.Types.ObjectId, ref: "InternalMessageThread" },
  },
  { timestamps: true },
);

accessRequestSchema.index({ requesterId: 1, status: 1 });
accessRequestSchema.index({ requestType: 1, status: 1 });

export type AccessRequestDoc = InferSchemaType<typeof accessRequestSchema>;

export const AccessRequest: Model<AccessRequestDoc> =
  (models.AccessRequest as Model<AccessRequestDoc>) ??
  model<AccessRequestDoc>("AccessRequest", accessRequestSchema);
