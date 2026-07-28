import type { SessionUser } from "@/lib/auth/session";
import type { CourseType } from "@/lib/domain/types";

/**
 * The authorization scope every course-aware query is filtered by.
 *
 * Two keys, both mandatory, both server-derived from the session — never from
 * anything the client sends. `ownerId` isolates one staff user's records from
 * another's; `courseType` isolates קפ"ה from מק"סים. A row must match BOTH to be
 * readable, so a foreign or cross-course id in a URL simply resolves to `null`
 * (→ 404) rather than being filtered out later on the client.
 */
export type OwnerScope = {
  ownerId: string;
  courseType: CourseType;
};

/**
 * Build a scope from the session, or `null` if the user has no course yet.
 *
 * A course-less session (a legacy account that has not passed through
 * /select-course) can therefore never read or write course-scoped data — it
 * cannot even construct the scope required to ask.
 */
export function scopeFromSession(user: SessionUser): OwnerScope | null {
  if (!user.courseType) return null;
  return { ownerId: user.id, courseType: user.courseType };
}
