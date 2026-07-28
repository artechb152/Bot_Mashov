import { COURSE_LABELS, type CourseType } from "@/lib/domain/types";

/**
 * Per-course configuration — the single seam through which the product adapts to
 * the logged-in user's course.
 *
 * The point of this file is to give future course-specific behaviour ONE place to
 * live, so it never gets scattered across components as `if (course === "kapeh")`
 * checks. Today both courses behave identically; only the label differs.
 *
 * The מק"סים requirements are not defined yet, so its future-facing fields are
 * deliberately left EMPTY rather than guessed. קפ"ה keeps today's behaviour.
 * Nothing here is wired to any AI — these are inert placeholders that the future
 * assistant layer will read.
 */
export type CourseConfig = {
  /** Stable internal id — matches the value stored on User/Trainee. */
  id: CourseType;
  /** Hebrew label for the UI (קפ"ה / מק"סים). */
  label: string;
  /** How the course is described to the future bot when framing a conversation. */
  assistantContextLabel: string;
  /**
   * Which knowledge units the future bot may draw on for this course.
   * Empty = "no course-specific scoping yet; use the general knowledge only".
   */
  knowledgeScopes: string[];
  /**
   * Course-specific addendum to the bot's system prompt. Empty for now — the
   * general prompt in `src/lib/bot/system-prompt.md` applies to both courses.
   */
  assistantInstructions: string;
};

export const COURSE_CONFIG: Record<CourseType, CourseConfig> = {
  kapeh: {
    id: "kapeh",
    label: COURSE_LABELS.kapeh,
    assistantContextLabel: 'סגל הדרכה בקורס קפ"ה',
    knowledgeScopes: [],
    assistantInstructions: "",
  },
  maksim: {
    id: "maksim",
    label: COURSE_LABELS.maksim,
    // Behaves exactly like קפ"ה until the מק"סים requirements are defined.
    assistantContextLabel: 'סגל הדרכה בקורס מק"סים',
    knowledgeScopes: [],
    assistantInstructions: "",
  },
};

export function getCourseConfig(course: CourseType): CourseConfig {
  return COURSE_CONFIG[course];
}
