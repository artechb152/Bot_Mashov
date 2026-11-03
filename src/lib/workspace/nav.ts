/**
 * חונך+ /workspace — pure cohort-selection helpers (Stage 4). No DB / no next — pure,
 * unit-testable. The cohort drives which trainees the work area shows; these functions
 * decide the ACTIVE cohort and whether a trainee belongs to the selected one.
 */

/** Sentinel cohort value for "trainees with no cohort assignment". */
export const NO_COHORT = "none";

/** Whether a trainee (by its cohortId) belongs to the currently-selected cohort. */
export function traineeMatchesCohort(traineeCohortId: string | null, selected: string | null): boolean {
  if (!selected) return true; // no cohort filter → show all
  if (selected === NO_COHORT) return traineeCohortId === null;
  return traineeCohortId === selected;
}

/**
 * Resolve the cohort the work area should open on, in priority order:
 *   1. an explicit, valid request (from `?cohort=` — real id in `available`, or the
 *      "unassigned" bucket when it has content);
 *   2. the user's personal default (User.defaultCohortId) if still available;
 *   3. the user's current assignment cohort if available;
 *   4. the most recent available cohort;
 *   5. the "unassigned" bucket if that is all there is;
 *   6. null (nothing to show).
 * `available` is the list of real cohort ids the user may navigate, most-recent-first.
 */
export function pickActiveCohort(opts: {
  requested?: string | null;
  defaultId?: string | null;
  assignmentId?: string | null;
  available: string[];
  hasUnassigned: boolean;
}): string | null {
  const { requested, defaultId, assignmentId, available, hasUnassigned } = opts;
  const isAvail = (id?: string | null): boolean => !!id && available.includes(id);

  if (requested === NO_COHORT) return hasUnassigned ? NO_COHORT : available[0] ?? null;
  if (isAvail(requested)) return requested as string;
  if (isAvail(defaultId)) return defaultId as string;
  if (isAvail(assignmentId)) return assignmentId as string;
  if (available.length > 0) return available[0];
  return hasUnassigned ? NO_COHORT : null;
}
