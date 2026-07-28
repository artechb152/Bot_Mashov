import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Team, User, UserAssignment } from "@/models";
import type { Account } from "@/lib/auth/account";
import { COURSE_LABELS, type CourseType } from "@/lib/domain/types";

/**
 * Messaging recipient permissions + resolution. The core security surface of the
 * inbox: it decides who a user may address and resolves groups to CONCRETE, active,
 * visible user IDs at SEND time (frozen thereafter). Hidden ghost accounts and
 * out-of-scope users are never selectable; disabled/suspended users are excluded
 * from resolution (suspended only kept for system/account messages).
 *
 * Server-only.
 */

export type RecipientCard = {
  id: string;
  displayName: string;
  username: string;
  role: string;
  courseType: CourseType | null;
};

export type GroupOption = { id: string; label: string };

export type RecipientSpec = { userIds?: string[]; groups?: string[] };

/** Mongo filter for the individual users `account` may DIRECTLY message. */
function messageableUserFilter(account: Account): Record<string, unknown> {
  const base: Record<string, unknown> = {
    directoryVisibility: { $ne: "hidden" },
    status: "active",
    _id: { $ne: new Types.ObjectId(account.id) },
  };
  if (account.role === "super_admin") return base; // any visible active user
  if (account.role === "admin") {
    return {
      ...base,
      $or: [{ courseType: account.courseType }, { role: "admin" }, { role: "super_admin" }],
    };
  }
  // staff: same-course staff + admins only (super-admins are reached via the group).
  return { ...base, courseType: account.courseType, role: { $in: ["staff", "admin"] } };
}

/**
 * Of `candidateIds`, the subset the actor is permitted to DIRECTLY message. Reuses
 * the exact same permission filter as compose/recipient search — the single source
 * of truth — so a "send message" action can be shown/validated per target without
 * duplicating the rules. Server-only.
 */
export async function messageableIds(account: Account, candidateIds: string[]): Promise<Set<string>> {
  const valid = candidateIds.filter((id) => isValidObjectId(id));
  if (valid.length === 0) return new Set();
  await connectToDatabase();
  const found = await User.find({
    ...messageableUserFilter(account),
    _id: { $in: valid.map((id) => new Types.ObjectId(id)) },
  })
    .select("_id")
    .lean<{ _id: unknown }[]>();
  return new Set(found.map((u) => String(u._id)));
}

/** Whether the actor may directly message this single user (server-side check). */
export async function canMessageUser(account: Account, userId: string): Promise<boolean> {
  if (!isValidObjectId(userId)) return false;
  return (await messageableIds(account, [userId])).has(userId);
}

type LeanUser = {
  _id: unknown;
  displayName?: string;
  fullName?: string;
  username?: string;
  role?: string;
  courseType?: string;
};

function card(u: LeanUser): RecipientCard {
  return {
    id: String(u._id),
    displayName: u.displayName || u.fullName || u.username || "",
    username: u.username || "",
    role: u.role || "staff",
    courseType: (u.courseType as CourseType) ?? null,
  };
}

async function teamsForCourse(courseId: string | null): Promise<{ id: string; name: string }[]> {
  if (!courseId || !isValidObjectId(courseId)) return [];
  const cohorts = await Cohort.find({ courseId: new Types.ObjectId(courseId) }).select("_id").lean<{ _id: unknown }[]>();
  const cohortIds = cohorts.map((c) => c._id);
  const teams = await Team.find({ cohortId: { $in: cohortIds }, isActive: { $ne: false } })
    .select("_id name")
    .lean<{ _id: unknown; name?: string }[]>();
  return teams.map((t) => ({ id: String(t._id), name: t.name ?? "" }));
}

/** Individual users the actor may message + the group destinations available. */
export async function listRecipientOptions(
  account: Account,
): Promise<{ users: RecipientCard[]; groups: GroupOption[] }> {
  await connectToDatabase();
  const users = (
    await User.find(messageableUserFilter(account))
      .select("_id displayName fullName username role courseType")
      .sort({ displayName: 1, username: 1 })
      .lean<LeanUser[]>()
  ).map(card);

  const groups: GroupOption[] = [{ id: "system_admins", label: "פנייה להנהלת המערכת" }];

  if (account.role === "staff" && account.courseType) {
    const assignment = await UserAssignment.findOne({ userId: account.id, isCurrent: true })
      .select("cohortId")
      .lean<{ cohortId?: unknown } | null>();
    if (assignment?.cohortId) {
      const teams = await Team.find({ cohortId: assignment.cohortId, isActive: { $ne: false } })
        .select("_id name")
        .lean<{ _id: unknown; name?: string }[]>();
      for (const t of teams) groups.push({ id: `team:${String(t._id)}`, label: `צוות: ${t.name ?? ""}` });
    }
    groups.push({ id: `course_admins:${account.courseType}`, label: "הנהלת הקורס" });
  } else if (account.role === "admin" && account.courseType) {
    for (const t of await teamsForCourse(account.courseId)) {
      groups.push({ id: `team:${t.id}`, label: `צוות: ${t.name}` });
    }
    groups.push({ id: `course:${account.courseType}`, label: `כל הקורס (${COURSE_LABELS[account.courseType]})` });
    groups.push({ id: `course_admins:${account.courseType}`, label: "הנהלת הקורס" });
  } else if (account.role === "super_admin") {
    for (const code of ["kapeh", "maksim"] as CourseType[]) {
      groups.push({ id: `course:${code}`, label: `כל הקורס (${COURSE_LABELS[code]})` });
      groups.push({ id: `course_admins:${code}`, label: `הנהלת ${COURSE_LABELS[code]}` });
    }
  }

  return { users, groups };
}

export type ResolveResult =
  | { ok: true; userIds: string[]; snapshot: Record<string, unknown>; total: number }
  | { ok: false; error: string };

async function activeUsersByCourseType(courseType: CourseType, roleFilter?: Record<string, unknown>) {
  return User.find({
    courseType,
    status: "active",
    directoryVisibility: { $ne: "hidden" },
    ...(roleFilter ?? {}),
  })
    .select("_id")
    .lean<{ _id: unknown }[]>();
}

/**
 * Resolve a recipient spec to concrete active user IDs, enforcing the actor's
 * permissions. `system` allows including suspended recipients (account notices).
 */
export async function resolveRecipients(
  account: Account,
  spec: RecipientSpec,
  opts: { system?: boolean } = {},
): Promise<ResolveResult> {
  await connectToDatabase();
  const ids = new Set<string>();
  const snapshot: Record<string, unknown> = {};

  // 1) Individual users — must pass the messageable filter (out-of-scope/hidden fail).
  const requested = (spec.userIds ?? []).filter((id) => isValidObjectId(id));
  if (requested.length > 0) {
    const allowed = await User.find({
      ...messageableUserFilter(account),
      _id: { $in: requested.map((id) => new Types.ObjectId(id)) },
    })
      .select("_id")
      .lean<{ _id: unknown }[]>();
    for (const u of allowed) ids.add(String(u._id));
    snapshot.recipientUserIds = allowed.map((u) => String(u._id));
  }

  // 2) Groups.
  for (const g of spec.groups ?? []) {
    if (g === "system_admins") {
      const supers = await User.find({
        role: "super_admin",
        status: "active",
        directoryVisibility: { $ne: "hidden" }, // hidden roots never included
      })
        .select("_id")
        .lean<{ _id: unknown }[]>();
      for (const u of supers) ids.add(String(u._id));
      continue;
    }
    const [kind, ref] = g.split(":");

    if (kind === "team") {
      if (!isValidObjectId(ref)) return { ok: false, error: "צוות לא תקין." };
      const team = await Team.findById(ref).select("courseId").lean<{ courseId?: unknown } | null>();
      if (!team) return { ok: false, error: "צוות לא תקין." };
      if (account.role !== "super_admin" && String(team.courseId) !== account.courseId) {
        return { ok: false, error: "אין הרשאה לשלוח לצוות זה." };
      }
      const members = await UserAssignment.find({ teamId: new Types.ObjectId(ref), isCurrent: true })
        .select("userId")
        .lean<{ userId?: unknown }[]>();
      const memberIds = members.map((m) => String(m.userId)).filter(Boolean);
      const active = await User.find({
        _id: { $in: memberIds.map((id) => new Types.ObjectId(id)) },
        status: opts.system ? { $ne: "disabled" } : "active",
        directoryVisibility: { $ne: "hidden" },
      })
        .select("_id")
        .lean<{ _id: unknown }[]>();
      for (const u of active) ids.add(String(u._id));
      snapshot.teamIds = [...((snapshot.teamIds as string[]) ?? []), ref];
      continue;
    }

    if (kind === "course" || kind === "course_admins") {
      const courseType = (["kapeh", "maksim"] as string[]).includes(ref) ? (ref as CourseType) : null;
      if (!courseType) return { ok: false, error: "קורס לא תקין." };
      if (kind === "course" && account.role === "staff") {
        return { ok: false, error: "אין הרשאה לשלוח לכל הקורס." };
      }
      if (account.role === "admin" && courseType !== account.courseType) {
        return { ok: false, error: "אין הרשאה לשלוח לקורס אחר." };
      }
      const roleFilter = kind === "course_admins" ? { role: "admin" } : undefined;
      const members = await activeUsersByCourseType(courseType, roleFilter);
      for (const u of members) ids.add(String(u._id));
      snapshot.courseType = courseType;
      continue;
    }

    return { ok: false, error: "יעד לא תקין." };
  }

  ids.delete(account.id); // the sender is added as a participant separately
  const userIds = [...ids];
  return { ok: true, userIds, snapshot, total: userIds.length };
}
