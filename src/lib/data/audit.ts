import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AuditLog, User, type AuditTargetType } from "@/models";

/**
 * Append an audit entry. Best-effort by design: a failed audit write is logged but
 * does NOT throw, so an audit hiccup can never lose or roll back the primary
 * operation (which has already been decided/attempted by the caller).
 *
 * NEVER pass secrets in before/after/metadata: no passwords, hashes, invite
 * plaintext, JWTs, cookies, or file contents. Callers should pass small, redacted
 * field snapshots only. Hidden-visibility accounts are still audited and attributed
 * — visibility never makes an action anonymous.
 *
 * Server-only.
 */
export type AuditInput = {
  actorId: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
};

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    if (!isValidObjectId(input.actorId) || !isValidObjectId(input.targetId)) {
      console.error("[audit] refused: invalid actorId/targetId");
      return;
    }
    await connectToDatabase();
    await AuditLog.create({
      actorId: new Types.ObjectId(input.actorId),
      action: input.action,
      targetType: input.targetType,
      targetId: new Types.ObjectId(input.targetId),
      before: input.before,
      after: input.after,
      reason: input.reason,
      metadata: input.metadata,
    });
  } catch (err) {
    // Never surface the primary operation's failure through audit; just record it.
    console.error("[audit] write failed:", err);
  }
}

export type AuditLogDTO = {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  reason: string | null;
  createdAt: string | null;
};

type LeanAudit = {
  _id: unknown;
  actorId?: unknown;
  action?: string;
  targetType?: string;
  targetId?: unknown;
  reason?: string | null;
  createdAt?: Date | string;
};

/**
 * Read audit entries (super-admin only — enforced by the caller). Resolves actor
 * display names. Hidden-visibility actors are STILL shown here — visibility never
 * makes an action anonymous in the audit trail.
 */
export async function listAuditLogs(
  filter: { actorId?: string; action?: string; targetType?: AuditTargetType; limit?: number } = {},
): Promise<AuditLogDTO[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (filter.actorId && isValidObjectId(filter.actorId)) q.actorId = new Types.ObjectId(filter.actorId);
  if (filter.action) q.action = filter.action;
  if (filter.targetType) q.targetType = filter.targetType;
  const limit = Math.min(Math.max(filter.limit ?? 200, 1), 500);

  const docs = await AuditLog.find(q).sort({ createdAt: -1, _id: -1 }).limit(limit).lean<LeanAudit[]>();
  const actorIds = [...new Set(docs.map((d) => (d.actorId ? String(d.actorId) : "")).filter(Boolean))];
  const actors = await User.find({ _id: { $in: actorIds } })
    .select("_id displayName username")
    .lean<{ _id: unknown; displayName?: string; username?: string }[]>();
  const nameById = new Map(actors.map((a) => [String(a._id), a.displayName || a.username || ""]));

  return docs.map((d) => ({
    id: String(d._id),
    actorId: d.actorId ? String(d.actorId) : "",
    actorName: nameById.get(String(d.actorId)) ?? "—",
    action: d.action ?? "",
    targetType: (d.targetType as AuditTargetType) ?? "user",
    targetId: d.targetId ? String(d.targetId) : "",
    reason: d.reason ?? null,
    createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : null,
  }));
}
