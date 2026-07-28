import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Trainee } from "@/models";
import { getAccount } from "@/lib/auth/account";
import { isActive, inactiveResponse, unauthenticatedResponse } from "@/lib/auth/require-active";
import { sameCourse } from "@/lib/auth/scope";
import { activeGrantLevel } from "@/lib/data/trainee-grants";

/**
 * Higher-level semantic gates that compose the role/status grants with a record
 * lookup, so a route gets one yes/no answer plus the record it may act on.
 *
 * `requireTraineeAccess` unifies the three access models for a single trainee:
 *   - staff       → owner-only (`commanderId === me && courseType === mine`).
 *                   Sharing a team never widens a staff user's access.
 *   - admin       → course-scoped (`courseType === mine`).
 *   - super_admin → global.
 *
 * Not-authorized resolves to 404 (never revealing whether the record exists),
 * except a staff owner hitting their own locked cohort, who gets a clear 403.
 *
 * Server-only.
 */

export type TraineeAccessInfo = {
  id: string;
  commanderId: string;
  courseType: string | null;
  courseId: string | null;
  cohortId: string | null;
  status: string;
};

/**
 * The server-authorized access LEVEL. Never trust a client-provided level — always
 * derive it from `requireTraineeAccess`. `view`/`edit` come from an active grant.
 */
export type TraineeAccessLevel = "owner" | "view" | "edit" | "course_admin" | "super_admin";

export type TraineeAccess =
  | { ok: true; actorId: string; trainee: TraineeAccessInfo; via: TraineeAccessLevel }
  | { ok: false; response: NextResponse };

type LeanTraineeAccess = {
  _id: unknown;
  commanderId?: unknown;
  courseType?: string | null;
  courseId?: unknown;
  cohortId?: unknown;
  status?: string;
};

function notFound(): NextResponse {
  return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 404 });
}

export async function requireTraineeAccess(
  traineeId: string,
  opts: { write?: boolean } = {},
): Promise<TraineeAccess> {
  const account = await getAccount();
  if (!account) return { ok: false, response: unauthenticatedResponse() };
  if (!isActive(account)) return { ok: false, response: inactiveResponse(account.status) };
  if (!isValidObjectId(traineeId)) return { ok: false, response: notFound() };

  await connectToDatabase();
  const doc = await Trainee.findById(traineeId)
    .select("_id commanderId courseType courseId cohortId status")
    .lean<LeanTraineeAccess | null>();
  if (!doc) return { ok: false, response: notFound() };

  const info: TraineeAccessInfo = {
    id: String(doc._id),
    commanderId: doc.commanderId ? String(doc.commanderId) : "",
    courseType: doc.courseType ?? null,
    courseId: doc.courseId ? String(doc.courseId) : null,
    cohortId: doc.cohortId ? String(doc.cohortId) : null,
    status: doc.status === "archived" ? "archived" : "active",
  };

  // Same-course check is courseId-first (authoritative), courseType fallback for legacy.
  const actorCourse = { courseId: account.courseId, courseType: account.courseType };
  const traineeCourse = { courseId: info.courseId, courseType: info.courseType };

  // super_admin — global.
  if (account.role === "super_admin") {
    return { ok: true, actorId: account.id, trainee: info, via: "super_admin" };
  }

  // admin — course-scoped (not blocked by cohort lock).
  if (account.role === "admin") {
    if (sameCourse(actorCourse, traineeCourse)) {
      return { ok: true, actorId: account.id, trainee: info, via: "course_admin" };
    }
    return { ok: false, response: notFound() };
  }

  // staff — owner-only.
  if (info.commanderId === account.id && sameCourse(actorCourse, traineeCourse)) {
    return { ok: true, actorId: account.id, trainee: info, via: "owner" };
  }

  // staff — an explicit, active access GRANT (from an approved request) also lets a
  // non-owner in, at the granted level. A view grant can never write. The returned
  // `via` is the exact grant level ("view" | "edit").
  const grant = await activeGrantLevel(traineeId, account.id);
  if (grant && sameCourse(actorCourse, traineeCourse)) {
    if (opts.write && grant !== "edit") return { ok: false, response: notFound() };
    return { ok: true, actorId: account.id, trainee: info, via: grant };
  }

  return { ok: false, response: notFound() };
}
