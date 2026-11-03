"use client";

import { useState } from "react";
import { Button, Dialog, EmptyState } from "@/components/ui";
import { COURSE_LABELS } from "@/lib/domain/types";
import { useWorkspace } from "./WorkspaceProvider";
import { DevelopmentTimeline } from "./DevelopmentTimeline";
import type { InsightDTO } from "@/lib/data/ai-insights";
import type { FinalEvaluationReadiness, TraineeOverviewOutput } from "@/lib/ai/types";

const READINESS_LABELS: Record<FinalEvaluationReadiness, string> = {
  supported: "יש בסיס תומך",
  needs_review: "נדרשת בחינה אנושית נוספת",
  insufficient_information: "אין די מידע להמלצה",
  concerns: "עולים חששות מהותיים",
};

/**
 * The main work area: a SINGLE professional review document ("סקירה") for the selected
 * trainee, built from the aggregated `trainee_overview` artifact. There are no separate
 * tabs — "ציר התפתחות" and "חוות דעת סוף" are SECTIONS within the one review. It never
 * fabricates AI content: with no provider wired it shows "AI עדיין לא מחובר", and a stale
 * artifact is shown as-is with a "sources changed" note + a regenerate action (old data
 * is kept, never deleted).
 */
export function TraineeOverviewPanel() {
  const { selectedTrainee, feedback, selectedSourceCount, overviewInsight, loading, ai, runTask } = useWorkspace();

  if (!selectedTrainee) {
    return (
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          title="בחרו חניך מהרשימה"
          description="לאחר בחירת חניך תוצג כאן הסקירה — תמונת מצב, חוזקות, פערים, מוקדים, ציר התפתחות וטיוטת חוות דעת."
        />
      </div>
    );
  }

  const busy = loading.task === "trainee_overview";
  const canGenerate = ai.configured && selectedSourceCount > 0;
  const generate = () => runTask("trainee_overview");
  const data = overviewInsight ? (overviewInsight.structuredOutput as TraineeOverviewOutput | null) : null;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="סקירת החניך">
      {/* Compact active-trainee header */}
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <h2 className="truncate text-base font-semibold text-ink">{selectedTrainee.fullName}</h2>
          <span className="text-xs text-muted">
            {COURSE_LABELS[selectedTrainee.courseType]}
            {selectedTrainee.team ? ` · ${selectedTrainee.team}` : ""}
          </span>
          <span className="text-xs text-subtle">
            · {feedback.length} משובים · {selectedSourceCount} מקורות נבחרו
          </span>
        </div>
        {overviewInsight && ai.configured ? (
          <button
            type="button"
            onClick={generate}
            disabled={busy || selectedSourceCount === 0}
            className="shrink-0 text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
          >
            {busy ? "מפיק…" : "הפק סקירה מחדש"}
          </button>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading.trainee ? (
          <p className="text-sm text-muted">טוען…</p>
        ) : !data || typeof data.snapshot !== "string" ? (
          <ReviewEmptyState
            aiConfigured={ai.configured}
            sourceCount={selectedSourceCount}
            canGenerate={canGenerate}
            busy={busy}
            onGenerate={generate}
          />
        ) : (
          <ReviewDocument
            insight={overviewInsight!}
            data={data}
            aiConfigured={ai.configured}
            busy={busy}
            onGenerate={generate}
            sourceCount={selectedSourceCount}
          />
        )}
      </div>
    </section>
  );
}

/** Empty state before a review exists — a clean prompt, not an AI-widget dashboard. */
function ReviewEmptyState({
  aiConfigured,
  sourceCount,
  canGenerate,
  busy,
  onGenerate,
}: {
  aiConfigured: boolean;
  sourceCount: number;
  canGenerate: boolean;
  busy: boolean;
  onGenerate: () => void;
}) {
  if (!aiConfigured) {
    return (
      <EmptyState
        title="AI עדיין לא מחובר"
        description="לאחר חיבור ספק ה-AI ניתן יהיה להפיק סקירה מהמשובים שנבחרו."
      />
    );
  }
  return (
    <div className="mx-auto max-w-md py-8 text-center">
      <h3 className="text-lg font-semibold text-ink">סקירה</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted">הפק סקירה המבוססת על המשובים שבחרת.</p>
      <div className="mt-5">
        <Button size="sm" onClick={onGenerate} disabled={!canGenerate || busy}>
          {busy ? "מפיק…" : "הפק סקירה"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-subtle">
        {sourceCount > 0 ? `על בסיס ${sourceCount} משובים שנבחרו` : "יש לבחור לפחות משוב אחד כמקור לפני הפקת הסקירה."}
      </p>
    </div>
  );
}

/** The full review document — six sections, rendered as one flowing professional page. */
function ReviewDocument({
  insight,
  data,
  aiConfigured,
  busy,
  onGenerate,
  sourceCount,
}: {
  insight: InsightDTO;
  data: TraineeOverviewOutput;
  aiConfigured: boolean;
  busy: boolean;
  onGenerate: () => void;
  sourceCount: number;
}) {
  const timelinePoints = data.timeline?.points ?? [];
  const fe = data.finalEvaluation;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {insight.status === "stale" ? (
        <StaleNote onRegenerate={onGenerate} aiConfigured={aiConfigured} busy={busy} disabled={sourceCount === 0} />
      ) : null}

      {/* 1. תמונת מצב כללית */}
      <Section title="תמונת מצב כללית">
        {data.snapshot ? (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{data.snapshot}</p>
        ) : null}
        <BulletList title="מגמות מרכזיות" items={data.trends} muted />
      </Section>

      {/* 2 + 3. חוזקות / פערים */}
      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="חוזקות ונקודות לשימור">
          <BulletList items={data.strengths} />
        </Section>
        <Section title="פערים ונקודות לשיפור">
          <BulletList items={data.gaps} />
        </Section>
      </div>

      {/* 4. מוקדים להמשך */}
      <Section title="מוקדים להמשך">
        <BulletList items={data.focus} />
      </Section>

      {/* 5. ציר התפתחות */}
      {timelinePoints.length > 0 ? (
        <Section title="ציר התפתחות">
          <DevelopmentTimeline data={{ points: timelinePoints, sourceFeedbackIds: [] }} />
        </Section>
      ) : null}

      {/* 6. חוות דעת סוף */}
      <Section title="חוות דעת סוף (טיוטה)">
        <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
          טיוטה בלבד — אינה חוות דעת רשמית ואינה קובעת כשירות. נדרשת עריכה ואישור של גורם מוסמך.
        </p>
        {fe?.overallEvaluation ? (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">סיכום תפקוד</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{fe.overallEvaluation}</p>
          </div>
        ) : null}
        {fe?.readiness ? (
          <div>
            <p className="mb-1 text-xs font-semibold text-muted">המלצת כשירות (המלצה בלבד)</p>
            <p className="text-sm text-ink">{READINESS_LABELS[fe.readiness.recommendation] ?? "—"}</p>
            {fe.readiness.reasoning ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
                {fe.readiness.reasoning}
              </p>
            ) : null}
          </div>
        ) : null}
        <BulletList title="דגשים למפקדים" items={fe?.commanderNotes} />
        <BulletList title="חוסרי מידע" items={fe?.evidenceGaps} />
        {fe ? <FinalEvaluationCopy data={data} /> : null}
      </Section>

      <p className="text-xs text-subtle">מבוסס על {insight.sourceFeedbackIds.length} משובי מקור.</p>
    </div>
  );
}

/** A "sources changed" banner for a stale review (never deletes the artifact). */
function StaleNote({
  onRegenerate,
  aiConfigured,
  busy,
  disabled,
}: {
  onRegenerate: () => void;
  aiConfigured: boolean;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
      <span>הסקירה אינה מעודכנת בעקבות שינוי במשובים.</span>
      {aiConfigured ? (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={busy || disabled}
          className="font-medium text-ink underline-offset-2 hover:underline disabled:opacity-50"
        >
          {busy ? "מפיק…" : "הפק סקירה מחדש"}
        </button>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function BulletList({ title, items, muted }: { title?: string; items?: string[]; muted?: boolean }) {
  const list = Array.isArray(items) ? items.filter((x) => typeof x === "string" && x.trim()) : [];
  if (list.length === 0) return null;
  return (
    <div>
      {title ? <p className="mb-1 text-xs font-semibold text-muted">{title}</p> : null}
      <ul className={`list-disc space-y-1 ps-5 text-sm leading-relaxed ${muted ? "text-muted" : "text-ink"}`}>
        {list.map((x, i) => (
          <li key={i} className="break-words">
            {x}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Copy the final-evaluation draft out (local-only; no official evaluation is saved). */
function FinalEvaluationCopy({ data }: { data: TraineeOverviewOutput }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const fe = data.finalEvaluation;

  async function copy() {
    const text = [
      "סיכום תפקוד:",
      fe.overallEvaluation,
      "",
      `המלצת כשירות (המלצה בלבד): ${READINESS_LABELS[fe.readiness.recommendation] ?? "—"}`,
      fe.readiness.reasoning,
      "",
      "דגשים למפקדים:",
      (fe.commanderNotes ?? []).join("\n"),
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => {
          setCopied(false);
          setOpen(true);
        }}
        className="text-xs font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
      >
        צפייה והעתקה
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="טיוטת חוות דעת סוף">
        <div className="space-y-4">
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
            טיוטה בלבד — אינה חוות דעת רשמית ואינה קובעת כשירות. אפשר להעתיק ולערוך במסמך חיצוני.
          </p>
          <div className="max-h-72 space-y-3 overflow-y-auto text-sm leading-relaxed text-ink">
            <p className="whitespace-pre-wrap break-words">{fe.overallEvaluation}</p>
            <p className="text-muted">
              המלצת כשירות (המלצה בלבד): {READINESS_LABELS[fe.readiness.recommendation] ?? "—"}
              {fe.readiness.reasoning ? ` — ${fe.readiness.reasoning}` : ""}
            </p>
            <BulletList title="דגשים למפקדים" items={fe.commanderNotes} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={copy}>
              {copied ? "הועתק" : "העתקה"}
            </Button>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              סגירה
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
