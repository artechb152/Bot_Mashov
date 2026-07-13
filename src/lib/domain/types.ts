/**
 * Shared domain enums for the Matzpen data layer.
 *
 * Each enum is defined once as a readonly tuple (used by Mongoose `enum`
 * validators) and paired with a derived TS union type and a Hebrew label map
 * for the UI. This keeps the values in a single source of truth.
 */

// Course selection was removed from the product UI. This enum is retained only
// so the Mongoose `courseType` field on legacy User/Trainee records still
// validates; it is no longer shown or collected anywhere.
export const COURSE_TYPES = ["kapeh", "maksim", "both"] as const;
export type CourseType = (typeof COURSE_TYPES)[number];

export const USER_ROLES = ["commander", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const FEEDBACK_TYPES = [
  "lesson",
  "simulation",
  "role_play",
  "final_exercise",
  "feedback_on_feedback",
  "other",
] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

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

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  commander: "מפקד",
  admin: "מנהל",
};

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  lesson: "שיעור",
  simulation: "סימולציה",
  role_play: "נע״ת",
  final_exercise: "תרגיל מסכם",
  feedback_on_feedback: "משוב על משוב",
  other: "אחר",
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
