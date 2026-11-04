"use client";

/**
 * The "use as AI source" checkbox for a single feedback entry. Presentational +
 * controlled — the parent owns the selection Set (default: all selected). The whole
 * label is the hit area (>=40px); `itemLabel` names the entry for screen readers.
 */
export function FeedbackSourceToggle({
  checked,
  onChange,
  disabled,
  itemLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  itemLabel?: string;
}) {
  return (
    <label
      className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 self-center rounded-lg px-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus"
      title="כשהתיבה מסומנת, העוזר משתמש במשוב הזה"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-control focus-visible:outline-none"
        aria-label={itemLabel ? `שימוש ב״${itemLabel}״ כמקור לעוזר` : "שימוש במשוב כמקור לעוזר"}
      />
      <span aria-hidden="true">מקור</span>
    </label>
  );
}
