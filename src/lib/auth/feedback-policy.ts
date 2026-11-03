import type { TraineeAccessLevel } from "@/lib/auth/access";

/**
 * PURE feedback-write policy (no DB / no next/server — unit-testable, like policy.ts).
 *
 * Who may edit / archive / restore a feedback entry, given the caller's SERVER-derived
 * trainee access level and whether they authored the entry:
 *   - a write level (owner / edit-grant / course admin / super_admin / root) → always;
 *   - a plain "view" level → only the entry's own AUTHOR;
 *   - anything else → never.
 * Creation is a separate, simpler check (write-level access to the trainee) enforced
 * directly by `requireTraineeAccess(id, { write: true })` at the route.
 */
const FEEDBACK_WRITE_LEVELS: ReadonlySet<TraineeAccessLevel> = new Set<TraineeAccessLevel>([
  "owner",
  "edit",
  "course_admin",
  "super_admin",
]);

export function isFeedbackWriteLevel(via: TraineeAccessLevel): boolean {
  return FEEDBACK_WRITE_LEVELS.has(via);
}

export function canEditFeedback(via: TraineeAccessLevel, isAuthor: boolean): boolean {
  if (isFeedbackWriteLevel(via)) return true;
  if (via === "view") return isAuthor;
  return false;
}
