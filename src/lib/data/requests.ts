import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AccessRequest, Cohort, Team, Trainee, User } from "@/models";
import type { Account } from "@/lib/auth/account";
import { writeAudit } from "@/lib/data/audit";
import { notify, notifyMany } from "@/lib/data/notifications";
import { grantTraineeAccess } from "@/lib/data/trainee-grants";
import { setCurrentAssignment } from "@/lib/data/assignments";
import { createSystemThread, appendSystemMessage } from "@/lib/data/messages";
import { courseTypeForId } from "@/lib/data/courses";
import {
  ACCESS_REQUEST_TYPE_LABELS,
  isAccessRequestType,
  isAdminPosition,
  type AccessRequestStatus,
  type AccessRequestType,
  type AdminPosition,
} from "@/lib/domain/types";

/**
 * Typed access-request engine. Reviewers are chosen by the SERVER. Only one open
 * request per (requester, type, target); a cooldown blocks re-submission after a
 * rejection/cancellation. Approval reloads + revalidates before applying exactly
 * the typed action, then audits + notifies + posts a system message.
 *
 * Server-only.
 */

const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export type RequestDTO = {
  id: string;
  requestType: AccessRequestType;
  requestTypeLabel: string;
  requesterId: string;
  requesterName: string;
  status: AccessRequestStatus;
  reason: string;
  reviewNote: string | null;
  targetSummary: string;
  createdAt: string | null;
  threadId: string | null;
};

type LeanReq = Record<string, unknown> & { _id: unknown };

async function name(id: string | undefined | null): Promise<string> {
  if (!id || !isValidObjectId(String(id))) return "";
  const u = await User.findById(id).select("displayName username").lean<{ displayName?: string; username?: string } | null>();
  return u?.displayName || u?.username || "";
}

/** The concrete target field for a given request type (used for dedup + revalidation). */
function targetField(input: CreateRequestInput): { key: string; value: string } | null {
  switch (input.requestType) {
    case "trainee_view":
    case "trainee_edit":
      return input.targetTraineeId ? { key: "targetTraineeId", value: input.targetTraineeId } : null;
    case "team_change":
      return input.targetTeamId ? { key: "targetTeamId", value: input.targetTeamId } : null;
    case "cohort_change":
      return input.targetCohortId ? { key: "targetCohortId", value: input.targetCohortId } : null;
    case "course_change":
      return input.targetCourseId ? { key: "targetCourseId", value: input.targetCourseId } : null;
    case "account_reactivation":
    case "admin_role_request":
      return { key: "targetUserId", value: input.targetUserId ?? "" };
  }
}

/** Server-side reviewer resolution — the browser never chooses reviewers. */
async function resolveReviewers(account: Account, requestType: AccessRequestType): Promise<string[]> {
  await connectToDatabase();
  const courseScoped: AccessRequestType[] = ["trainee_view", "trainee_edit", "team_change", "cohort_change"];
  if (courseScoped.includes(requestType) && account.courseType) {
    const admins = await User.find({ role: "admin", status: "active", courseType: account.courseType })
      .select("_id")
      .lean<{ _id: unknown }[]>();
    return admins.map((a) => String(a._id));
  }
  // course_change, account_reactivation, admin_role_request → super-admins.
  const supers = await User.find({ role: "super_admin", status: "active" }).select("_id").lean<{ _id: unknown }[]>();
  return supers.map((s) => String(s._id));
}

export type CreateRequestInput = {
  requestType: AccessRequestType;
  reason: string;
  targetTraineeId?: string;
  targetTeamId?: string;
  targetCohortId?: string;
  targetCourseId?: string;
  targetUserId?: string;
  payload?: Record<string, unknown>;
};

export type CreateRequestResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid" | "duplicate" | "cooldown" | "no_reviewer" };

export async function createRequest(account: Account, input: CreateRequestInput): Promise<CreateRequestResult> {
  await connectToDatabase();
  if (!isAccessRequestType(input.requestType)) return { ok: false, reason: "invalid" };
  const reason = (input.reason ?? "").trim();
  if (!reason) return { ok: false, reason: "invalid" };
  const target = targetField(input);

  // One open request per (requester, type, target).
  const dupFilter: Record<string, unknown> = { requesterId: account.id, requestType: input.requestType, status: "pending" };
  if (target && target.value) dupFilter[target.key] = target.value;
  if (await AccessRequest.exists(dupFilter)) return { ok: false, reason: "duplicate" };

  // Cooldown after a recent rejection/cancellation of the same type+target.
  const cdFilter: Record<string, unknown> = {
    requesterId: account.id,
    requestType: input.requestType,
    status: { $in: ["rejected", "cancelled"] },
    updatedAt: { $gt: new Date(Date.now() - COOLDOWN_MS) },
  };
  if (target && target.value) cdFilter[target.key] = target.value;
  if (await AccessRequest.exists(cdFilter)) return { ok: false, reason: "cooldown" };

  const reviewers = await resolveReviewers(account, input.requestType);
  if (reviewers.length === 0) return { ok: false, reason: "no_reviewer" };

  const doc = await AccessRequest.create({
    requesterId: new Types.ObjectId(account.id),
    requestType: input.requestType,
    targetTraineeId: input.targetTraineeId && isValidObjectId(input.targetTraineeId) ? new Types.ObjectId(input.targetTraineeId) : undefined,
    targetTeamId: input.targetTeamId && isValidObjectId(input.targetTeamId) ? new Types.ObjectId(input.targetTeamId) : undefined,
    targetCohortId: input.targetCohortId && isValidObjectId(input.targetCohortId) ? new Types.ObjectId(input.targetCohortId) : undefined,
    targetCourseId: input.targetCourseId && isValidObjectId(input.targetCourseId) ? new Types.ObjectId(input.targetCourseId) : undefined,
    targetUserId: input.targetUserId && isValidObjectId(input.targetUserId) ? new Types.ObjectId(input.targetUserId) : undefined,
    payload: input.payload,
    reason,
    status: "pending",
    assignedReviewerIds: reviewers.map((r) => new Types.ObjectId(r)),
  });

  // Request appears as a system/request thread with the reviewers.
  const threadId = await createSystemThread({
    subject: `בקשה: ${ACCESS_REQUEST_TYPE_LABELS[input.requestType]}`,
    body: `בקשה חדשה מאת ${account.username}.\nסיבה: ${reason}`,
    createdBy: account.id,
    participantIds: [account.id, ...reviewers],
    relatedRequestId: String(doc._id),
    relatedTraineeIds: input.targetTraineeId ? [input.targetTraineeId] : undefined,
  });
  await AccessRequest.updateOne({ _id: doc._id }, { $set: { threadId: new Types.ObjectId(threadId) } });

  await notifyMany(reviewers, {
    type: "request.received",
    title: "בקשה חדשה לטיפול",
    body: ACCESS_REQUEST_TYPE_LABELS[input.requestType],
    relatedType: "request",
    relatedId: String(doc._id),
    link: `/requests/${String(doc._id)}`,
  });

  return { ok: true, id: String(doc._id) };
}

async function serialize(doc: LeanReq): Promise<RequestDTO> {
  const type = (doc.requestType as AccessRequestType) ?? "trainee_view";
  return {
    id: String(doc._id),
    requestType: type,
    requestTypeLabel: ACCESS_REQUEST_TYPE_LABELS[type] ?? String(type),
    requesterId: String(doc.requesterId),
    requesterName: await name(String(doc.requesterId)),
    status: (doc.status as AccessRequestStatus) ?? "pending",
    reason: (doc.reason as string) ?? "",
    reviewNote: (doc.reviewNote as string) ?? null,
    targetSummary: await targetSummary(doc),
    createdAt: doc.createdAt ? new Date(doc.createdAt as string).toISOString() : null,
    threadId: doc.threadId ? String(doc.threadId) : null,
  };
}

async function targetSummary(doc: LeanReq): Promise<string> {
  if (doc.targetTraineeId) {
    const t = await Trainee.findById(String(doc.targetTraineeId)).select("fullName").lean<{ fullName?: string } | null>();
    return t?.fullName ? `חניך: ${t.fullName}` : "חניך";
  }
  if (doc.targetTeamId) {
    const t = await Team.findById(String(doc.targetTeamId)).select("name").lean<{ name?: string } | null>();
    return t?.name ? `צוות: ${t.name}` : "צוות";
  }
  if (doc.targetCohortId) {
    const c = await Cohort.findById(String(doc.targetCohortId)).select("name").lean<{ name?: string } | null>();
    return c?.name ? `מחזור: ${c.name}` : "מחזור";
  }
  if (doc.targetUserId) return `משתמש: ${await name(String(doc.targetUserId))}`;
  return "";
}

export async function listMyRequests(userId: string): Promise<RequestDTO[]> {
  if (!isValidObjectId(userId)) return [];
  await connectToDatabase();
  const docs = await AccessRequest.find({ requesterId: userId }).sort({ createdAt: -1 }).lean<LeanReq[]>();
  return Promise.all(docs.map(serialize));
}

export async function listReviewRequests(account: Account, opts: { pendingOnly?: boolean } = {}): Promise<RequestDTO[]> {
  await connectToDatabase();
  const q: Record<string, unknown> = { assignedReviewerIds: new Types.ObjectId(account.id) };
  if (opts.pendingOnly) q.status = "pending";
  const docs = await AccessRequest.find(q).sort({ createdAt: -1 }).lean<LeanReq[]>();
  return Promise.all(docs.map(serialize));
}

export async function getRequest(account: Account, id: string): Promise<RequestDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await AccessRequest.findOne({
    _id: id,
    $or: [{ requesterId: new Types.ObjectId(account.id) }, { assignedReviewerIds: new Types.ObjectId(account.id) }],
  }).lean<LeanReq | null>();
  return doc ? serialize(doc) : null;
}

/* -------------------------------------------------------------------------- */
/* Decisions                                                                   */
/* -------------------------------------------------------------------------- */

export type DecisionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "not_reviewer" | "not_pending" | "invalid_target" | "note_required" | "forbidden" };

/** Apply the exact typed action. Assumes reviewer authorization already checked. */
async function applyAction(doc: LeanReq, reviewer: Account): Promise<{ ok: true } | { ok: false; error: string }> {
  const type = doc.requestType as AccessRequestType;

  if (type === "trainee_view" || type === "trainee_edit") {
    const traineeId = String(doc.targetTraineeId ?? "");
    const trainee = await Trainee.findById(traineeId).select("_id").lean();
    if (!trainee) return { ok: false, error: "החניך אינו קיים עוד." };
    await grantTraineeAccess({
      traineeId,
      granteeUserId: String(doc.requesterId),
      permission: type === "trainee_edit" ? "edit" : "view",
      grantedBy: reviewer.id,
      sourceRequestId: String(doc._id),
    });
    return { ok: true };
  }

  if (type === "team_change") {
    const teamId = String(doc.targetTeamId ?? "");
    const team = await Team.findById(teamId).select("courseId cohortId isActive").lean<{ courseId?: unknown; cohortId?: unknown; isActive?: boolean } | null>();
    if (!team || team.isActive === false) return { ok: false, error: "הצוות אינו זמין עוד." };
    // The centralized service validates the relationships and syncs User.courseId.
    const res = await setCurrentAssignment(reviewer.id, String(doc.requesterId), {
      courseId: String(team.courseId),
      cohortId: team.cohortId ? String(team.cohortId) : undefined,
      teamId,
      assignmentType: "staff_team",
      role: "staff",
    });
    if (!res.ok) return { ok: false, error: "עדכון השיוך נכשל." };
    return { ok: true };
  }

  if (type === "cohort_change") {
    const cohortId = String(doc.targetCohortId ?? "");
    const cohort = await Cohort.findById(cohortId).select("courseId status").lean<{ courseId?: unknown; status?: string } | null>();
    if (!cohort || cohort.status === "archived") return { ok: false, error: "המחזור אינו זמין עוד." };
    const res = await setCurrentAssignment(reviewer.id, String(doc.requesterId), {
      courseId: String(cohort.courseId),
      cohortId,
      assignmentType: "staff_team",
      role: "staff",
    });
    if (!res.ok) return { ok: false, error: "עדכון השיוך נכשל." };
    return { ok: true };
  }

  if (type === "course_change") {
    const courseId = String(doc.targetCourseId ?? "");
    const courseType = await courseTypeForId(courseId);
    if (!courseType) return { ok: false, error: "הקורס אינו קיים." };
    // setCurrentAssignment now writes User.courseId + mirrors courseType, so no
    // separate User update is needed here.
    const res = await setCurrentAssignment(reviewer.id, String(doc.requesterId), {
      courseId,
      assignmentType: "staff_team",
      role: "staff",
    });
    if (!res.ok) return { ok: false, error: "עדכון השיוך נכשל." };
    return { ok: true };
  }

  if (type === "account_reactivation") {
    const target = String(doc.targetUserId ?? doc.requesterId);
    const u = await User.findById(target).select("status isRootSuperAdmin").lean<{ status?: string; isRootSuperAdmin?: boolean } | null>();
    if (!u) return { ok: false, error: "המשתמש אינו קיים." };
    if (u.isRootSuperAdmin) return { ok: false, error: "לא ניתן לשנות חשבון מוגן." };
    await User.updateOne({ _id: target }, { $set: { status: "active" } });
    await writeAudit({ actorId: reviewer.id, action: "user.status_changed", targetType: "user", targetId: target, before: { status: u.status }, after: { status: "active" }, reason: "account_reactivation request" });
    await notify({ userId: target, type: "account.reactivated", title: "החשבון הופעל מחדש", relatedType: "user", relatedId: target, link: "/settings/profile" });
    return { ok: true };
  }

  if (type === "admin_role_request") {
    // staff → admin ONLY. Never super_admin.
    const target = String(doc.targetUserId ?? doc.requesterId);
    const u = await User.findById(target).select("role courseType courseId isRootSuperAdmin").lean<{ role?: string; courseType?: string; courseId?: unknown; isRootSuperAdmin?: boolean } | null>();
    if (!u) return { ok: false, error: "המשתמש אינו קיים." };
    if (u.isRootSuperAdmin) return { ok: false, error: "לא ניתן לשנות חשבון מוגן." };
    if (u.role !== "staff") return { ok: false, error: "המשתמש אינו סגל עוד." };
    const payload = (doc.payload ?? {}) as { adminPosition?: unknown };
    const position: AdminPosition = isAdminPosition(payload.adminPosition) ? payload.adminPosition : "deputy_course_commander";
    await User.updateOne({ _id: target }, { $set: { role: "admin", adminPosition: position } });
    await writeAudit({ actorId: reviewer.id, action: "user.role_changed", targetType: "user", targetId: target, before: { role: "staff" }, after: { role: "admin", adminPosition: position }, reason: "admin_role_request approved" });
    if (u.courseId) {
      await setCurrentAssignment(reviewer.id, target, { courseId: String(u.courseId), assignmentType: "course_admin", role: "admin", adminPosition: position });
    }
    return { ok: true };
  }

  return { ok: false, error: "סוג בקשה לא נתמך." };
}

export async function approveRequest(account: Account, id: string, note: string): Promise<DecisionResult> {
  if (!isValidObjectId(id)) return { ok: false, reason: "not_found" };
  const reviewNote = (note ?? "").trim();
  if (!reviewNote) return { ok: false, reason: "note_required" };
  await connectToDatabase();

  const doc = await AccessRequest.findById(id).lean<LeanReq | null>();
  if (!doc) return { ok: false, reason: "not_found" };
  if (doc.status !== "pending") return { ok: false, reason: "not_pending" };
  const reviewerIds = (doc.assignedReviewerIds as unknown[] | undefined)?.map(String) ?? [];
  if (!reviewerIds.includes(account.id)) return { ok: false, reason: "not_reviewer" };
  if (String(doc.requesterId) === account.id) return { ok: false, reason: "forbidden" }; // no self-approval

  const applied = await applyAction(doc, account);
  if (!applied.ok) return { ok: false, reason: "invalid_target" };

  // Atomically flip to approved only if still pending (guards concurrent approval).
  const res = await AccessRequest.updateOne(
    { _id: id, status: "pending" },
    { $set: { status: "approved", reviewedBy: new Types.ObjectId(account.id), reviewedAt: new Date(), reviewNote } },
  );
  if (res.matchedCount === 0) return { ok: false, reason: "not_pending" };

  await writeAudit({ actorId: account.id, action: "request.approved", targetType: "request", targetId: id, reason: reviewNote, metadata: { requestType: doc.requestType } });
  await notify({ userId: String(doc.requesterId), type: "request.approved", title: "הבקשה אושרה", body: reviewNote, relatedType: "request", relatedId: id, link: `/requests/${id}` });
  if (doc.threadId) await appendSystemMessage(String(doc.threadId), account.id, `הבקשה אושרה. הערת מאשר: ${reviewNote}`);
  return { ok: true };
}

export async function rejectRequest(account: Account, id: string, note: string): Promise<DecisionResult> {
  if (!isValidObjectId(id)) return { ok: false, reason: "not_found" };
  const reviewNote = (note ?? "").trim();
  if (!reviewNote) return { ok: false, reason: "note_required" };
  await connectToDatabase();

  const doc = await AccessRequest.findById(id).lean<LeanReq | null>();
  if (!doc) return { ok: false, reason: "not_found" };
  if (doc.status !== "pending") return { ok: false, reason: "not_pending" };
  const reviewerIds = (doc.assignedReviewerIds as unknown[] | undefined)?.map(String) ?? [];
  if (!reviewerIds.includes(account.id)) return { ok: false, reason: "not_reviewer" };

  const res = await AccessRequest.updateOne(
    { _id: id, status: "pending" },
    { $set: { status: "rejected", reviewedBy: new Types.ObjectId(account.id), reviewedAt: new Date(), reviewNote } },
  );
  if (res.matchedCount === 0) return { ok: false, reason: "not_pending" };

  await writeAudit({ actorId: account.id, action: "request.rejected", targetType: "request", targetId: id, reason: reviewNote, metadata: { requestType: doc.requestType } });
  await notify({ userId: String(doc.requesterId), type: "request.rejected", title: "הבקשה נדחתה", body: reviewNote, relatedType: "request", relatedId: id, link: `/requests/${id}` });
  if (doc.threadId) await appendSystemMessage(String(doc.threadId), account.id, `הבקשה נדחתה. הערת מאשר: ${reviewNote}`);
  return { ok: true };
}

export async function cancelRequest(account: Account, id: string): Promise<DecisionResult> {
  if (!isValidObjectId(id)) return { ok: false, reason: "not_found" };
  await connectToDatabase();
  const doc = await AccessRequest.findById(id).lean<LeanReq | null>();
  if (!doc) return { ok: false, reason: "not_found" };
  if (String(doc.requesterId) !== account.id) return { ok: false, reason: "forbidden" };
  if (doc.status !== "pending") return { ok: false, reason: "not_pending" };

  await AccessRequest.updateOne({ _id: id, status: "pending" }, { $set: { status: "cancelled", reviewedAt: new Date() } });
  await writeAudit({ actorId: account.id, action: "request.cancelled", targetType: "request", targetId: id, metadata: { requestType: doc.requestType } });
  const reviewerIds = (doc.assignedReviewerIds as unknown[] | undefined)?.map(String) ?? [];
  await notifyMany(reviewerIds, { type: "request.cancelled", title: "בקשה בוטלה", relatedType: "request", relatedId: id, link: `/requests/${id}` });
  return { ok: true };
}
