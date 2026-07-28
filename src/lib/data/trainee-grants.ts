import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Trainee, TraineeAccessGrant } from "@/models";
import { writeAudit } from "@/lib/data/audit";
import { notify } from "@/lib/data/notifications";
import type { Account } from "@/lib/auth/account";

/**
 * Scoped, revocable trainee-access grants — the real mechanism behind approved
 * trainee_view / trainee_edit requests. A grant NEVER changes ownership; it lets a
 * non-owner view or edit ONE trainee until revoked/expired. Grants + revocations
 * are audited.
 *
 * Server-only.
 */

export type GrantLevel = "view" | "edit";
export type TraineeAccessLevel = "none" | "view" | "edit" | "owner" | "course_admin" | "super_admin";

/** The active grant level (if any) for (trainee, user) — highest of view/edit. */
export async function activeGrantLevel(traineeId: string, userId: string): Promise<GrantLevel | null> {
  if (!isValidObjectId(traineeId) || !isValidObjectId(userId)) return null;
  await connectToDatabase();
  const now = new Date();
  const grants = await TraineeAccessGrant.find({
    traineeId,
    granteeUserId: userId,
    revokedAt: { $exists: false },
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  })
    .select("permission")
    .lean<{ permission?: string }[]>();
  if (grants.some((g) => g.permission === "edit")) return "edit";
  if (grants.some((g) => g.permission === "view")) return "view";
  return null;
}

/**
 * The effective access an account has to a trainee, combining ownership, role
 * scope, and active grants. Used for message trainee-references and the request
 * flow (never bypasses the server gates that enforce the same rules).
 */
export async function traineeAccessLevel(account: Account, traineeId: string): Promise<TraineeAccessLevel> {
  if (!isValidObjectId(traineeId)) return "none";
  await connectToDatabase();
  if (account.role === "super_admin") return "super_admin";
  const t = await Trainee.findById(traineeId).select("commanderId courseType").lean<{ commanderId?: unknown; courseType?: string } | null>();
  if (!t) return "none";
  if (account.role === "admin") {
    return account.courseType && account.courseType === t.courseType ? "course_admin" : "none";
  }
  // staff
  if (String(t.commanderId) === account.id && t.courseType === account.courseType) return "owner";
  const grant = await activeGrantLevel(traineeId, account.id);
  return grant ?? "none";
}

export async function grantTraineeAccess(input: {
  traineeId: string;
  granteeUserId: string;
  permission: GrantLevel;
  grantedBy: string;
  sourceRequestId?: string;
  expiresAt?: Date;
}): Promise<{ ok: true; id: string } | { ok: false; reason: "invalid" }> {
  if (!isValidObjectId(input.traineeId) || !isValidObjectId(input.granteeUserId)) {
    return { ok: false, reason: "invalid" };
  }
  await connectToDatabase();
  const doc = await TraineeAccessGrant.create({
    traineeId: new Types.ObjectId(input.traineeId),
    granteeUserId: new Types.ObjectId(input.granteeUserId),
    permission: input.permission,
    grantedBy: new Types.ObjectId(input.grantedBy),
    sourceRequestId: input.sourceRequestId && isValidObjectId(input.sourceRequestId) ? new Types.ObjectId(input.sourceRequestId) : undefined,
    expiresAt: input.expiresAt,
  });
  await writeAudit({
    actorId: input.grantedBy,
    action: "trainee.access_granted",
    targetType: "trainee",
    targetId: input.traineeId,
    after: { granteeUserId: input.granteeUserId, permission: input.permission },
    metadata: input.sourceRequestId ? { sourceRequestId: input.sourceRequestId } : undefined,
  });
  // Notify the grantee (separate from the audit trail). Text is generic — no
  // trainee details. The link is authorized independently by requireTraineeAccess.
  await notify({
    userId: input.granteeUserId,
    type: "trainee.access_granted",
    title: input.permission === "edit" ? "ניתנה לך הרשאת עריכה לתיק חניך" : "ניתנה לך הרשאת צפייה לתיק חניך",
    relatedType: "trainee",
    relatedId: input.traineeId,
    link: `/trainees/${input.traineeId}`,
  });
  return { ok: true, id: String(doc._id) };
}

export async function revokeTraineeAccess(
  grantId: string,
  revokedBy: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
  if (!isValidObjectId(grantId)) return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const doc = await TraineeAccessGrant.findOneAndUpdate(
    { _id: grantId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedBy: new Types.ObjectId(revokedBy) } },
    { new: true },
  ).lean<{ traineeId?: unknown; granteeUserId?: unknown } | null>();
  if (!doc) return { ok: false, reason: "not_found" };
  await writeAudit({
    actorId: revokedBy,
    action: "trainee.access_revoked",
    targetType: "trainee",
    targetId: String(doc.traineeId),
    after: { granteeUserId: String(doc.granteeUserId) },
  });
  // Notify the grantee. The link points at their trainee list (not the now-revoked
  // record) — and even the trainee page would re-authorize and deny after revoke.
  await notify({
    userId: String(doc.granteeUserId),
    type: "trainee.access_revoked",
    title: "הגישה שלך לתיק חניך בוטלה",
    relatedType: "trainee",
    relatedId: String(doc.traineeId),
    link: "/trainees",
  });
  return { ok: true };
}

export type GrantDTO = {
  id: string;
  traineeId: string;
  granteeUserId: string;
  permission: GrantLevel;
  expiresAt: string | null;
  createdAt: string | null;
};

export async function listGrantsForTrainee(traineeId: string): Promise<GrantDTO[]> {
  if (!isValidObjectId(traineeId)) return [];
  await connectToDatabase();
  const docs = await TraineeAccessGrant.find({ traineeId, revokedAt: { $exists: false } })
    .sort({ createdAt: -1 })
    .lean<{ _id: unknown; traineeId?: unknown; granteeUserId?: unknown; permission?: string; expiresAt?: Date | string; createdAt?: Date | string }[]>();
  return docs.map((g) => ({
    id: String(g._id),
    traineeId: String(g.traineeId),
    granteeUserId: String(g.granteeUserId),
    permission: g.permission === "edit" ? "edit" : "view",
    expiresAt: g.expiresAt ? new Date(g.expiresAt).toISOString() : null,
    createdAt: g.createdAt ? new Date(g.createdAt).toISOString() : null,
  }));
}
