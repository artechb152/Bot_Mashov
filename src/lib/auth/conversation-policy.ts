import type { TraineeAccessLevel } from "@/lib/auth/access";

/**
 * PURE conversation-access policy (no DB / no next/server — unit-testable).
 *
 * Applied IN ADDITION to `requireTraineeAccess` (which already proves the caller may
 * see the conversation's trainee). On top of that:
 *   - the conversation OWNER may always access it;
 *   - an authorized MANAGER (admin in course → `course_admin`, or `super_admin`/root)
 *     may access another user's conversation for a trainee in their scope;
 *   - a non-owner staff member (owner-level or a plain view/edit grant) may NOT —
 *     conversations are personal.
 */
const MANAGER_LEVELS: ReadonlySet<TraineeAccessLevel> = new Set<TraineeAccessLevel>([
  "course_admin",
  "super_admin",
]);

export function canAccessConversation(
  actorId: string,
  via: TraineeAccessLevel,
  conversation: { ownerId: string },
): boolean {
  if (conversation.ownerId === actorId) return true;
  return MANAGER_LEVELS.has(via);
}
