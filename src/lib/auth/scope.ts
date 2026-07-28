import { Types } from "mongoose";
import type { AdminGrant } from "@/lib/auth/require-admin";

/**
 * Course-scope bridge for the staged courseType → courseId migration.
 *
 * Source-of-truth policy (locked): `courseId` is the AUTHORITATIVE course scope for
 * staff/admin; `UserAssignment` holds the current cohort/team + assignment history;
 * super_admin/root are global (no course). Records may still carry only the legacy
 * `courseType` during the transition, so every scoped query/comparison reads
 * `courseId` FIRST and falls back to `courseType` ONLY for records that have no
 * `courseId`. No new logic keys on `courseType` alone; the fallback exists purely so
 * untouched legacy rows keep resolving until the consistency audit is clean.
 *
 * Applies to the collections that carry BOTH the additive `courseId` ref and the
 * legacy `courseType` string: User, Trainee, TraineeAttachment.
 */

/** A course-scope pair from either an account or a record. */
export type CoursePair = { courseId: string | null; courseType: string | null };

/**
 * Mongo filter fragment scoping an AdminGrant to its course. courseId-first, with a
 * courseType fallback for records that predate courseId. super_admin/root → global.
 */
export function courseScopeQuery(grant: AdminGrant): Record<string, unknown> {
  if (!grant.courseScope) return {}; // super_admin / root → global (all courses)
  const { courseId, courseType } = grant.courseScope;
  if (courseId) {
    const cid = new Types.ObjectId(courseId);
    // courseId wins. `{ courseId: null }` matches both missing and null, so the
    // fallback branch catches legacy records that never got a courseId.
    return courseType ? { $or: [{ courseId: cid }, { courseId: null, courseType }] } : { courseId: cid };
  }
  if (courseType) return { courseType }; // legacy admin with no courseId yet
  return { _id: { $exists: false } }; // fail-closed: an admin with neither matches nothing
}

/**
 * True if `actor` and `record` are in the same course. courseId-first: if both sides
 * carry a courseId they must match exactly (courseId is authoritative — a drifted
 * courseType can never widen access). Falls back to courseType only when a side has
 * no courseId (legacy).
 */
export function sameCourse(actor: CoursePair, record: CoursePair): boolean {
  if (actor.courseId && record.courseId) return actor.courseId === record.courseId;
  return Boolean(actor.courseType) && actor.courseType === record.courseType;
}
