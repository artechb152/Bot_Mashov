import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AdminInvite, Course, type AdminInviteStatus } from "@/models";
import { writeAudit } from "@/lib/data/audit";
import { notify } from "@/lib/data/notifications";
import { generateInviteCode, hashInviteCode } from "@/lib/auth/invite-code";
import { ADMIN_POSITIONS, isAdminPosition, type AdminPosition } from "@/lib/domain/types";

/**
 * Admin-invite service. Any super-admin may issue/revoke `admin` invites; invites
 * never create super-admins. Only the code hash is stored; the plaintext is
 * returned once at creation and never again. Consumption is atomic (single-use,
 * concurrency-safe). Server-only.
 */

export const INVITE_EXPIRY_HOURS = [1, 24, 72, 168] as const; // שעה / 24 / 72 / 7 ימים

export type InviteDTO = {
  id: string;
  courseId: string;
  courseName: string;
  allowedAdminPositions: AdminPosition[];
  status: AdminInviteStatus;
  expiresAt: string | null;
  createdAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
};

type LeanInvite = {
  _id: unknown;
  courseId?: unknown;
  allowedAdminPositions?: string[];
  status?: string;
  expiresAt?: Date | string;
  createdAt?: Date | string;
  usedAt?: Date | string | null;
  revokedAt?: Date | string | null;
};

function effectiveStatus(doc: LeanInvite): AdminInviteStatus {
  const status = (doc.status as AdminInviteStatus) ?? "active";
  if (status === "active" && doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
    return "expired";
  }
  return status;
}

function serialize(doc: LeanInvite, courseName: string): InviteDTO {
  const positions = Array.isArray(doc.allowedAdminPositions)
    ? doc.allowedAdminPositions.filter(isAdminPosition)
    : [];
  return {
    id: String(doc._id),
    courseId: doc.courseId ? String(doc.courseId) : "",
    courseName,
    allowedAdminPositions: positions,
    status: effectiveStatus(doc),
    expiresAt: doc.expiresAt ? new Date(doc.expiresAt).toISOString() : null,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    usedAt: doc.usedAt ? new Date(doc.usedAt).toISOString() : null,
    revokedAt: doc.revokedAt ? new Date(doc.revokedAt).toISOString() : null,
  };
}

export type IssueInviteInput = {
  courseId: string;
  allowedAdminPositions?: AdminPosition[];
  expiresInHours?: number;
};

export type IssueInviteResult =
  | { ok: true; invite: InviteDTO; plaintext: string }
  | { ok: false; reason: "invalid_course" | "invalid_input" };

export async function issueInvite(actorId: string, input: IssueInviteInput): Promise<IssueInviteResult> {
  await connectToDatabase();
  if (!isValidObjectId(input.courseId)) return { ok: false, reason: "invalid_course" };
  const course = await Course.findById(input.courseId).select("_id name").lean<{ _id: unknown; name?: string } | null>();
  if (!course) return { ok: false, reason: "invalid_course" };

  const requested = (input.allowedAdminPositions ?? []).filter(isAdminPosition);
  const positions = requested.length > 0 ? requested : [...ADMIN_POSITIONS];

  const hours = INVITE_EXPIRY_HOURS.includes((input.expiresInHours ?? 24) as (typeof INVITE_EXPIRY_HOURS)[number])
    ? (input.expiresInHours as number)
    : 24;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

  const { plaintext, codeHash } = generateInviteCode();
  const doc = await AdminInvite.create({
    codeHash,
    role: "admin",
    courseId: new Types.ObjectId(input.courseId),
    allowedAdminPositions: positions,
    expiresAt,
    status: "active",
    createdBy: new Types.ObjectId(actorId),
  });

  await writeAudit({
    actorId,
    action: "invite.created",
    targetType: "invite",
    targetId: String(doc._id),
    // Never store the code or hash in audit.
    after: { courseId: input.courseId, allowedAdminPositions: positions, expiresAt: expiresAt.toISOString() },
  });

  return {
    ok: true,
    invite: serialize(doc.toObject() as LeanInvite, course.name ?? ""),
    plaintext, // shown ONCE — the caller must not persist or log it.
  };
}

export async function revokeInvite(
  actorId: string,
  inviteId: string,
): Promise<{ ok: true; invite: InviteDTO } | { ok: false; reason: "not_found" | "not_active" }> {
  if (!isValidObjectId(inviteId)) return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const doc = await AdminInvite.findOneAndUpdate(
    { _id: inviteId, status: "active" },
    { $set: { status: "revoked", revokedBy: new Types.ObjectId(actorId), revokedAt: new Date() } },
    { new: true },
  ).lean<LeanInvite | null>();
  if (!doc) {
    const exists = await AdminInvite.exists({ _id: inviteId });
    return { ok: false, reason: exists ? "not_active" : "not_found" };
  }
  await writeAudit({ actorId, action: "invite.revoked", targetType: "invite", targetId: inviteId });
  const course = await Course.findById(doc.courseId).select("name").lean<{ name?: string } | null>();
  return { ok: true, invite: serialize(doc, course?.name ?? "") };
}

export async function listInvites(filter: { courseId?: string; status?: AdminInviteStatus } = {}): Promise<InviteDTO[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = {};
  if (filter.courseId && isValidObjectId(filter.courseId)) q.courseId = filter.courseId;
  if (filter.status && filter.status !== "expired") q.status = filter.status;
  const docs = await AdminInvite.find(q).sort({ createdAt: -1, _id: -1 }).lean<LeanInvite[]>();
  const courses = await Course.find({}).select("_id name").lean<{ _id: unknown; name?: string }[]>();
  const nameById = new Map(courses.map((c) => [String(c._id), c.name ?? ""]));
  let dtos = docs.map((d) => serialize(d, nameById.get(String(d.courseId)) ?? ""));
  if (filter.status === "expired") dtos = dtos.filter((d) => d.status === "expired");
  return dtos;
}

export type ValidateInviteResult =
  | { ok: true; courseId: string; courseName: string; allowedAdminPositions: AdminPosition[] }
  | { ok: false; reason: "invalid" | "expired" | "used" | "revoked" };

/** Non-destructive pre-check used during the admin signup step. */
export async function validateInvite(plaintext: string): Promise<ValidateInviteResult> {
  await connectToDatabase();
  const codeHash = hashInviteCode(plaintext);
  const doc = await AdminInvite.findOne({ codeHash }).lean<LeanInvite | null>();
  if (!doc) return { ok: false, reason: "invalid" };
  const status = effectiveStatus(doc);
  if (status === "revoked") return { ok: false, reason: "revoked" };
  if (status === "used") return { ok: false, reason: "used" };
  if (status === "expired") return { ok: false, reason: "expired" };
  const course = await Course.findById(doc.courseId).select("name").lean<{ name?: string } | null>();
  return {
    ok: true,
    courseId: String(doc.courseId),
    courseName: course?.name ?? "",
    allowedAdminPositions: Array.isArray(doc.allowedAdminPositions)
      ? doc.allowedAdminPositions.filter(isAdminPosition)
      : [],
  };
}

export type ConsumeInviteResult =
  | { ok: true; courseId: string; allowedAdminPositions: AdminPosition[] }
  | { ok: false; reason: "invalid" | "expired" | "used" | "revoked" | "invalid_position" };

/**
 * Atomically consume an invite for `userId`, optionally validating a chosen admin
 * position. The conditional update (status active→used, not expired) guarantees
 * single-use even under concurrent signups. If the chosen position is not allowed,
 * the consume is rolled back so the invite stays usable.
 */
export async function consumeInvite(
  plaintext: string,
  userId: string,
  chosenPosition?: AdminPosition,
): Promise<ConsumeInviteResult> {
  await connectToDatabase();
  const codeHash = hashInviteCode(plaintext);

  const doc = await AdminInvite.findOneAndUpdate(
    { codeHash, status: "active", expiresAt: { $gt: new Date() } },
    { $set: { status: "used", usedBy: new Types.ObjectId(userId), usedAt: new Date() } },
    { new: true },
  ).lean<LeanInvite | null>();

  if (!doc) {
    // Determine the precise reason for the user (best-effort, read-only).
    const existing = await AdminInvite.findOne({ codeHash }).lean<LeanInvite | null>();
    if (!existing) return { ok: false, reason: "invalid" };
    const status = effectiveStatus(existing);
    if (status === "revoked") return { ok: false, reason: "revoked" };
    if (status === "expired") return { ok: false, reason: "expired" };
    return { ok: false, reason: "used" };
  }

  const allowed = Array.isArray(doc.allowedAdminPositions)
    ? doc.allowedAdminPositions.filter(isAdminPosition)
    : [];
  if (chosenPosition && !allowed.includes(chosenPosition)) {
    // Roll back — do not burn the invite on a bad position choice.
    await AdminInvite.updateOne(
      { _id: doc._id },
      { $set: { status: "active" }, $unset: { usedBy: "", usedAt: "" } },
    );
    return { ok: false, reason: "invalid_position" };
  }

  await writeAudit({
    actorId: userId,
    action: "invite.used",
    targetType: "invite",
    targetId: String(doc._id),
    metadata: { courseId: String(doc.courseId) },
  });

  const createdBy = (doc as { createdBy?: unknown }).createdBy;
  if (createdBy) {
    await notify({
      userId: String(createdBy),
      type: "invite.used",
      title: "קוד הרשאה נוצל",
      body: "משתמש חדש נרשם עם קוד ההרשאה שיצרת.",
      relatedType: "invite",
      relatedId: String(doc._id),
      link: "/system/invites",
    });
  }

  return { ok: true, courseId: String(doc.courseId), allowedAdminPositions: allowed };
}
