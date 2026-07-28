import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * Append-only audit trail for privileged actions. Records who did what to which
 * record, with before/after snapshots and an optional reason.
 *
 * NEVER store secrets here: no passwords, hashes, invite plaintext, JWTs, cookies,
 * session tokens, or file/attachment contents. Hidden accounts' actions are still
 * logged and attributed — directory visibility never makes an action anonymous.
 */
export const AUDIT_TARGET_TYPES = [
  "user",
  "assignment",
  "course",
  "cohort",
  "team",
  "trainee",
  "document",
  "message",
  "request",
  "invite",
] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

const auditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true },
    targetType: { type: String, enum: [...AUDIT_TARGET_TYPES], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

export type AuditLogDoc = InferSchemaType<typeof auditLogSchema>;

export const AuditLog: Model<AuditLogDoc> =
  (models.AuditLog as Model<AuditLogDoc>) ?? model<AuditLogDoc>("AuditLog", auditLogSchema);
