"use client";

import type { DevelopmentTimelineOutput, TimelinePointKind } from "@/lib/ai/types";

/**
 * Renders a development_timeline artifact as a vertical, chronological rail. Pure
 * presentation over the structured output — no fetching, no AI. Unknown/miss-shaped
 * output degrades to nothing rather than throwing.
 */

const KIND_LABELS: Record<TimelinePointKind, string> = {
  start: "נקודת פתיחה",
  event: "אירוע",
  trend: "מגמה",
  improvement: "שיפור",
  open: "פתוח להמשך",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "";
  }
}

export function DevelopmentTimeline({ data }: { data: DevelopmentTimelineOutput }) {
  const points = Array.isArray(data.points) ? data.points : [];
  if (points.length === 0) {
    return <p className="text-sm text-muted">אין עדיין נקודות ציר להצגה.</p>;
  }
  return (
    <ol className="relative space-y-4 border-s border-line ps-5">
      {points.map((p, i) => (
        <li key={i} className="relative">
          <span
            className="absolute -start-[23px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-surface bg-subtle"
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-medium text-ink">{p.title}</span>
            <span className="text-sm text-subtle">{KIND_LABELS[p.kind] ?? ""}</span>
            {p.at ? <span className="text-sm tabular-nums text-subtle">· {formatDate(p.at)}</span> : null}
          </div>
          {p.detail ? <p className="mt-0.5 whitespace-pre-wrap break-words text-base leading-relaxed text-muted">{p.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}
