"use client";

/**
 * A small "use as AI source" toggle for a single feedback entry. Presentational +
 * controlled — the parent owns the selection Set (default: all selected). `compact`
 * hides the text label (used in the dense feedback row), keeping the accessible name.
 */
export function FeedbackSourceToggle({
  checked,
  onChange,
  disabled,
  compact = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-muted" title="שימוש במשוב כמקור ל-AI">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-line accent-brand-action"
        aria-label="שימוש במשוב כמקור ל-AI"
      />
      {compact ? null : "מקור ל-AI"}
    </label>
  );
}
