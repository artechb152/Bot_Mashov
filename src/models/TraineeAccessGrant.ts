import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A scoped, revocable grant letting a NON-owner user view or edit a specific
 * trainee — the real mechanism behind approved trainee_view/trainee_edit requests.
 * It NEVER changes trainee ownership. `requireTraineeAccess` consults active grants
 * (revokedAt unset, not expired). Grants + revocations are audited.
 */
const grantSchema = new Schema(
  {
    traineeId: { type: Schema.Types.ObjectId, ref: "Trainee", required: true, index: true },
    granteeUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    permission: { type: String, enum: ["view", "edit"], required: true },
    grantedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceRequestId: { type: Schema.Types.ObjectId, ref: "AccessRequest" },
    expiresAt: { type: Date },
    revokedAt: { type: Date },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

grantSchema.index({ traineeId: 1, granteeUserId: 1 });

export type TraineeAccessGrantDoc = InferSchemaType<typeof grantSchema>;

export const TraineeAccessGrant: Model<TraineeAccessGrantDoc> =
  (models.TraineeAccessGrant as Model<TraineeAccessGrantDoc>) ??
  model<TraineeAccessGrantDoc>("TraineeAccessGrant", grantSchema);
