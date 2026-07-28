"use client";

import { cn } from "@/lib/cn";
import { COURSE_TYPES, COURSE_LABELS, type CourseType } from "@/lib/domain/types";

/**
 * The course a staff user belongs to — קפ"ה or מק"סים. A person belongs to
 * exactly one, so this is a single-select radio group rendered as two segments.
 *
 * Native radios (visually hidden) keep keyboard/arrow-key selection and screen
 * readers working; the visible segments are plain labels. Shared by the signup
 * form and the one-time /select-course screen so the two can never drift apart.
 */
export const COURSE_CHOICE_LABEL = "אני משתייך/ת ל:";

type CourseChoiceProps = {
  value: CourseType | null;
  onChange: (course: CourseType) => void;
  /** Radio group name — must be unique per form. */
  name?: string;
  disabled?: boolean;
};

export function CourseChoice({
  value,
  onChange,
  name = "courseType",
  disabled = false,
}: CourseChoiceProps) {
  return (
    <div className="space-y-1.5">
      <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {COURSE_CHOICE_LABEL}
        <span className="text-danger" aria-hidden="true">
          *
        </span>
      </span>
      <div
        role="radiogroup"
        aria-label={COURSE_CHOICE_LABEL}
        className="grid grid-cols-2 gap-1.5 rounded-xl border border-line-strong bg-surface p-1.5"
      >
        {COURSE_TYPES.map((course) => {
          const active = course === value;
          return (
            <label
              key={course}
              className={cn(
                "cursor-pointer rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition-colors",
                "focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-900/20",
                active
                  ? "bg-slate-900 text-white"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
                disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name={name}
                value={course}
                checked={active}
                disabled={disabled}
                onChange={() => onChange(course)}
                className="sr-only"
              />
              {COURSE_LABELS[course]}
            </label>
          );
        })}
      </div>
    </div>
  );
}
