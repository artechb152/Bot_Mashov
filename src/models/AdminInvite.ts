import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { ADMIN_POSITIONS } from "@/lib/domain/types";

/**
 * A temporary, one-time admin invite. Replaces the old shared static admin code.
 *
 * Only the SHA-256 hash of the high-entropy plaintext code is stored — the
 * plaintext is shown once at creation and never persisted, logged, echoed, or put
 * in a URL. Invites are per-course, expiring, revocable, and single-use. Consuming
 * one is an atomic conditional update (status active→used) so it can't be reused or
 * consumed concurrently. Records are never TTL-deleted (that would lose history);
 * expiry is a logical status.
 */
export const ADMIN_INVITE_STATUSES = ["active", "used", "revoked", "expired"] as const;
export type AdminInviteStatus = (typeof ADMIN_INVITE_STATUSES)[number];

const adminInviteSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true },
    role: { type: String, enum: ["admin"], required: true, default: "admin" },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", required: true, index: true },
    allowedAdminPositions: { type: [String], enum: [...ADMIN_POSITIONS], default: [] },
    expiresAt: { type: Date, required: true },
    status: { type: String, enum: [...ADMIN_INVITE_STATUSES], required: true, default: "active", index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    usedBy: { type: Schema.Types.ObjectId, ref: "User" },
    usedAt: { type: Date },
    revokedBy: { type: Schema.Types.ObjectId, ref: "User" },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

adminInviteSchema.index({ expiresAt: 1 });

export type AdminInviteDoc = InferSchemaType<typeof adminInviteSchema>;

export const AdminInvite: Model<AdminInviteDoc> =
  (models.AdminInvite as Model<AdminInviteDoc>) ??
  model<AdminInviteDoc>("AdminInvite", adminInviteSchema);
