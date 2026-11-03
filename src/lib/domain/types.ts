/**
 * Shared domain enums for the Matzpen data layer.
 *
 * Each enum is defined once as a readonly tuple (used by Mongoose `enum`
 * validators) and paired with a derived TS union type and a Hebrew label map
 * for the UI. This keeps the values in a single source of truth.
 */

/**
 * The two courses the product serves. A PERSON — a staff user, and therefore
 * every trainee they own — belongs to exactly one of them. This is the enum that
 * drives signup, the session, and all owner+course data scoping.
 */
export const COURSE_TYPES = ["kapeh", "maksim"] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

/**
 * Which course(s) a piece of CONTENT applies to. Unlike a person, a simulation
 * or a נע״ת scenario can legitimately serve both courses — hence the extra
 * "both" member. Kept separate from COURSE_TYPES so that narrowing the people
 * enum can never invalidate existing content rows.
 */
export const COURSE_SCOPES = ["kapeh", "maksim", "both"] as const;
export type CourseScope = (typeof COURSE_SCOPES)[number];

/**
 * System permission role.
 *   - "staff"       — a regular course user; sees only their own trainees, scoped
 *                     by course.
 *   - "admin"       — a course manager; global within their assigned course.
 *   - "super_admin" — a system manager; global across all courses.
 * A user's power comes from this role — never from their courseType. The protected
 * ROOT tier is not a role: it is the orthogonal `isRootSuperAdmin` boolean on a
 * super_admin (see the User model), created only by the local bootstrap script.
 */
export const USER_ROLES = ["staff", "admin", "super_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * The management roles. Both `admin` and `super_admin` reach the management
 * surface; the difference is scope (a plain admin is course-bound, a super_admin
 * is global) — resolved by the grant layer, not by role alone. Use `isAdminRole`
 * instead of `=== "admin"` for any "is this user a manager?" check.
 */
export const ADMIN_ROLES = ["admin", "super_admin"] as const;
export function isAdminRole(role: UserRole): role is "admin" | "super_admin" {
  return role === "admin" || role === "super_admin";
}

/**
 * Account lifecycle status. There is NO user deletion — suspending or disabling
 * preserves all records; only access is affected. `active` = normal;
 * `suspended` = temporarily blocked; `disabled` = retained but unusable.
 */
export const USER_STATUSES = ["active", "suspended", "disabled"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/**
 * Administrator DISPLAY position (מק״ס / סמק״ס). This is display + filtering
 * metadata only — both positions use the same `admin` role and grant the same
 * authorization. Never authorize off a position.
 */
export const ADMIN_POSITIONS = ["course_commander", "deputy_course_commander"] as const;
export type AdminPosition = (typeof ADMIN_POSITIONS)[number];

/**
 * Directory visibility. `hidden` removes an account from the user directory and
 * from messaging recipient search only — it NEVER affects authorization, audit,
 * or last-manager counts (a hidden root's actions are still attributed).
 */
export const DIRECTORY_VISIBILITIES = ["visible", "hidden"] as const;
export type DirectoryVisibility = (typeof DIRECTORY_VISIBILITIES)[number];

/**
 * Protected-root PROFILE. This is NOT a role and NOT an authorization level — it is
 * a refinement of a root super_admin (`isRootSuperAdmin: true`), set ONLY by the
 * local bootstrap script and never editable via any API or UI:
 *   - platform_owner   — the hidden website owner/developer account (oversight,
 *                        maintenance, testing). Hidden from directory + recipients.
 *   - school_commander — the VISIBLE school commander (shown with a crown), with
 *                        full system administration AND course/bot/trainee access.
 * A regular super_admin (isRootSuperAdmin: false) has `rootProfile: null`.
 */
export const ROOT_PROFILES = ["platform_owner", "school_commander"] as const;
export type RootProfile = (typeof ROOT_PROFILES)[number];

/**
 * Onboarding state. A promoted admin who still needs a position selected is
 * `requires_admin_position`; everyone else is `complete`.
 */
export const ONBOARDING_STATUSES = ["complete", "requires_admin_position"] as const;
export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

/**
 * Cohort (course-cycle) lifecycle. Archiving is a status change — archived cohorts
 * stay in place and remain accessible; there is no separate archive collection.
 */
export const COHORT_STATUSES = ["planned", "active", "archived"] as const;
export type CohortStatus = (typeof COHORT_STATUSES)[number];

/** Trainee record lifecycle (active vs archived). */
export const TRAINEE_STATUSES = ["active", "archived"] as const;
export type TraineeStatus = (typeof TRAINEE_STATUSES)[number];

/** Internal message thread kinds. */
export const MESSAGE_THREAD_TYPES = ["direct", "broadcast", "request", "system"] as const;
export type MessageThreadType = (typeof MESSAGE_THREAD_TYPES)[number];

/** Typed access-request kinds. */
export const ACCESS_REQUEST_TYPES = [
  "trainee_view",
  "trainee_edit",
  "team_change",
  "cohort_change",
  "course_change",
  "account_reactivation",
  "admin_role_request",
] as const;
export type AccessRequestType = (typeof ACCESS_REQUEST_TYPES)[number];

export const ACCESS_REQUEST_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const;
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];

export const FEEDBACK_TYPES = [
  "lesson",
  "simulation",
  "role_play",
  "final_exercise",
  "feedback_on_feedback",
  "other",
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** Narrow an untrusted value (request body) to a FeedbackType. */
export function isFeedbackType(value: unknown): value is FeedbackType {
  return typeof value === "string" && (FEEDBACK_TYPES as readonly string[]).includes(value);
}

/** Feedback record lifecycle (active vs soft-archived — there is no hard delete). */
export const FEEDBACK_STATUSES = ["active", "archived"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export function isFeedbackStatus(value: unknown): value is FeedbackStatus {
  return typeof value === "string" && (FEEDBACK_STATUSES as readonly string[]).includes(value);
}

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const KNOWLEDGE_CATEGORIES = [
  "feedback_rubrics",
  "simulations",
  "scenarios",
  "final_exercise",
  "lessons",
  "procedures",
  "other",
] as const;
export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

export const KNOWLEDGE_SOURCE_TYPES = ["manual", "file", "link", "other"] as const;
export type KnowledgeSourceType = (typeof KNOWLEDGE_SOURCE_TYPES)[number];

export const KNOWLEDGE_STATUSES = ["draft", "ready", "archived"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

/* ---------------------------------------------------------------------------
 * Hebrew labels for the UI (single source of truth alongside the enums above).
 * ------------------------------------------------------------------------- */

export const COURSE_LABELS: Record<CourseType, string> = {
  kapeh: 'קפ"ה',
  maksim: 'מק"סים',
};

export const COURSE_SCOPE_LABELS: Record<CourseScope, string> = {
  ...COURSE_LABELS,
  both: "שני הקורסים",
};

/** Narrow an untrusted value (form field, request body) to a CourseType. */
export function isCourseType(value: unknown): value is CourseType {
  return typeof value === "string" && (COURSE_TYPES as readonly string[]).includes(value);
}

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  staff: "סגל",
  admin: "מנהל",
  super_admin: "מנהל־על",
};

/** Narrow an untrusted value (DB field, request body) to a UserRole. */
export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "פעיל",
  suspended: "מושהה",
  disabled: "מושבת",
};

/** Narrow an untrusted value to a UserStatus. */
export function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === "string" && (USER_STATUSES as readonly string[]).includes(value);
}

export const ADMIN_POSITION_LABELS: Record<AdminPosition, string> = {
  course_commander: 'מק"ס',
  deputy_course_commander: 'סמק"ס',
};

/** Narrow an untrusted value to an AdminPosition. */
export function isAdminPosition(value: unknown): value is AdminPosition {
  return typeof value === "string" && (ADMIN_POSITIONS as readonly string[]).includes(value);
}

/** Narrow an untrusted value to a DirectoryVisibility. */
export function isDirectoryVisibility(value: unknown): value is DirectoryVisibility {
  return typeof value === "string" && (DIRECTORY_VISIBILITIES as readonly string[]).includes(value);
}

export const ROOT_PROFILE_LABELS: Record<RootProfile, string> = {
  platform_owner: "בעל המערכת",
  school_commander: "מפקד בית הספר",
};

/** Narrow an untrusted value to a RootProfile. */
export function isRootProfile(value: unknown): value is RootProfile {
  return typeof value === "string" && (ROOT_PROFILES as readonly string[]).includes(value);
}

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  lesson: "שיעור",
  simulation: "סימולציה",
  role_play: "נע״ת",
  final_exercise: "תרגיל מסכם",
  feedback_on_feedback: "משוב על משוב",
  other: "אחר",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  active: "פעיל",
  archived: "בארכיון",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "קל",
  medium: "בינוני",
  hard: "קשה",
};

export const KNOWLEDGE_CATEGORY_LABELS: Record<KnowledgeCategory, string> = {
  feedback_rubrics: "מחווני משוב",
  simulations: "סימולציות",
  scenarios: "תרחישי נע״ת",
  final_exercise: "תרגיל מסכם",
  lessons: "שיעורים",
  procedures: "נהלים",
  other: "אחר",
};

export const KNOWLEDGE_SOURCE_TYPE_LABELS: Record<KnowledgeSourceType, string> = {
  manual: "ידני",
  file: "קובץ",
  link: "קישור",
  other: "אחר",
};

export const KNOWLEDGE_STATUS_LABELS: Record<KnowledgeStatus, string> = {
  draft: "טיוטה",
  ready: "מוכן",
  archived: "בארכיון",
};

export const COHORT_STATUS_LABELS: Record<CohortStatus, string> = {
  planned: "מתוכנן",
  active: "פעיל",
  archived: "בארכיון",
};

/** Narrow an untrusted value to a CohortStatus. */
export function isCohortStatus(value: unknown): value is CohortStatus {
  return typeof value === "string" && (COHORT_STATUSES as readonly string[]).includes(value);
}

export const TRAINEE_STATUS_LABELS: Record<TraineeStatus, string> = {
  active: "פעיל",
  archived: "בארכיון",
};

export const ACCESS_REQUEST_TYPE_LABELS: Record<AccessRequestType, string> = {
  trainee_view: "צפייה בתיק חניך",
  trainee_edit: "עריכת תיק חניך",
  team_change: "שינוי צוות",
  cohort_change: "שינוי מחזור",
  course_change: "שינוי קורס",
  account_reactivation: "הפעלת חשבון מחדש",
  admin_role_request: "בקשת הרשאת מנהל",
};

export const ACCESS_REQUEST_STATUS_LABELS: Record<AccessRequestStatus, string> = {
  pending: "ממתין",
  approved: "אושר",
  rejected: "נדחה",
  cancelled: "בוטל",
};

export function isAccessRequestType(v: unknown): v is AccessRequestType {
  return typeof v === "string" && (ACCESS_REQUEST_TYPES as readonly string[]).includes(v);
}
