"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
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

function formatDateTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("he-IL", { day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return null;
  }
}

/**
 * The "סקירה" view: ONE professional review document for the selected trainee, built
 * from the aggregated `trainee_overview` artifact. Timeline and final-evaluation draft
 * are sections of that one document, not separate cards. It never fabricates AI
 * content: with no provider it says so, and a stale artifact stays visible with a
 * "sources changed" note and a regenerate action (old data is kept, never deleted).
 */
export function TraineeReview() {
  const { feedback, selectedSourceCount, overviewInsight, loading, ai, runTask, setActiveTab } = useWorkspace();

  const busy = loading.task === "trainee_overview";
  const canGenerate = ai.configured && selectedSourceCount > 0;
  const generate = () => runTask("trainee_overview");
  const data = overviewInsight ? (overviewInsight.structuredOutput as TraineeOverviewOutput | null) : null;

  if (loading.trainee) {
    return (
      <div className="mx-auto max-w-3xl space-y-3" aria-busy="true">
        <p className="sr-only">טוען את נתוני החניך…</p>
        <div className="h-5 w-40 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-surface-2" />
      </div>
    );
  }

  if (!data || typeof data.snapshot !== "string") {
    return (
      <ReviewEmptyState
        aiConfigured={ai.configured}
        feedbackCount={feedback.length}
        sourceCount={selectedSourceCount}
        canGenerate={canGenerate}
        busy={busy}
        onGenerate={generate}
        onGoToFeedback={() => setActiveTab("feedback")}
      />
    );
  }

  return (
    <ReviewDocument
      insight={overviewInsight!}
      data={data}
      aiConfigured={ai.configured}
      busy={busy}
      onGenerate={generate}
      sourceCount={selectedSourceCount}
    />
  );
}

/** Before a review exists — one clear next step, not an AI-widget dashboard. */
function ReviewEmptyState({
  aiConfigured,
  feedbackCount,
  sourceCount,
  canGenerate,
  busy,
  onGenerate,
  onGoToFeedback,
}: {
  aiConfigured: boolean;
  feedbackCount: number;
  sourceCount: number;
  canGenerate: boolean;
  busy: boolean;
  onGenerate: () => void;
  onGoToFeedback: () => void;
}) {
  let title = "עדיין אין סקירה לחניך";
  let body = "הסקירה מסכמת את המשובים שסומנו כמקור: תמונת מצב, חוזקות, פערים, מוקדים להמשך וטיוטת חוות דעת.";
  if (!aiConfigured) {
    title = "העוזר עדיין לא מחובר";
    body = "אפשר להמשיך לתעד משובים. הפקת סקירה תתאפשר לאחר חיבור ספק ה-AI.";
  } else if (feedbackCount === 0) {
    body = "כדי להפיק סקירה צריך לפחות משוב אחד. התחילו מתיעוד משוב לחניך.";
  } else if (sourceCount === 0) {
    body = "כל המשובים מסומנים כרגע כלא-מקור. סמנו לפחות משוב אחד כמקור כדי להפיק סקירה.";
  }

  return (
    <div className="mx-auto max-w-xl py-10 text-center sm:py-16">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      <p className="mt-2 text-base leading-relaxed text-muted">{body}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {aiConfigured && feedbackCount > 0 ? (
          <Button onClick={onGenerate} disabled={!canGenerate || busy}>
            {busy ? "מפיק סקירה…" : "הפקת סקירה"}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onGoToFeedback}>
          {feedbackCount === 0 ? "מעבר למשובים" : "בחירת מקורות"}
        </Button>
      </div>
      {aiConfigured && sourceCount > 0 ? (
        <p className="mt-3 text-sm text-subtle">על בסיס {sourceCount} משובים שסומנו כמקור</p>
      ) : null}
    </div>
  );
}

/** The full review document — one flowing professional page. */
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
  const generatedAt = formatDateTime(insight.updatedAt ?? insight.createdAt);

  return (
    <article className="mx-auto max-w-3xl space-y-8" aria-label="סקירת החניך">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line pb-3 text-sm text-subtle">
        <span>
          מבוסס על {insight.sourceFeedbackIds.length} משובים{generatedAt ? ` · הופק ${generatedAt}` : ""}
        </span>
        {aiConfigured ? (
          <Button variant="quiet" size="sm" onClick={onGenerate} disabled={busy || sourceCount === 0} className="-me-3">
            <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {busy ? "מפיק…" : "הפקה מחדש"}
          </Button>
        ) : null}
      </div>

      {insight.status === "stale" ? (
        <p role="status" className="rounded-lg border border-warn-line bg-warn-surface px-4 py-3 text-sm text-warn">
          המשובים השתנו מאז שהסקירה הופקה, ולכן היא אינה מעודכנת. אפשר להמשיך לקרוא אותה או להפיק אותה מחדש.
        </p>
      ) : null}

      <Section title="תמונת מצב כללית">
        {data.snapshot ? <Prose>{data.snapshot}</Prose> : null}
        <BulletList title="מגמות מרכזיות" items={data.trends} muted />
      </Section>

      <div className="grid gap-8 md:grid-cols-2">
        <Section title="חוזקות ונקודות לשימור">
          <BulletList items={data.strengths} />
        </Section>
        <Section title="פערים ונקודות לשיפור">
          <BulletList items={data.gaps} />
        </Section>
      </div>

      <Section title="מוקדים להמשך">
        <BulletList items={data.focus} />
      </Section>

      {timelinePoints.length > 0 ? (
        <Section title="ציר התפתחות">
          <DevelopmentTimeline data={{ points: timelinePoints, sourceFeedbackIds: [] }} />
        </Section>
      ) : null}

      <Section title="חוות דעת סוף — טיוטה">
        <p className="text-sm text-muted">
          טיוטה בלבד: אינה חוות דעת רשמית ואינה קובעת כשירות. נדרשים עריכה ואישור של גורם מוסמך.
        </p>
        {fe?.overallEvaluation ? (
          <div>
            <h4 className="mb-1 text-sm font-semibold text-muted">סיכום תפקוד</h4>
            <Prose>{fe.overallEvaluation}</Prose>
          </div>
        ) : null}
        {fe?.readiness ? (
          <div>
            <h4 className="mb-1 text-sm font-semibold text-muted">המלצת כשירות (המלצה בלבד)</h4>
            <p className="text-base text-ink">{READINESS_LABELS[fe.readiness.recommendation] ?? "—"}</p>
            {fe.readiness.reasoning ? <Prose muted>{fe.readiness.reasoning}</Prose> : null}
          </div>
        ) : null}
        <BulletList title="דגשים למפקדים" items={fe?.commanderNotes} />
        <BulletList title="חוסרי מידע" items={fe?.evidenceGaps} />
        {fe ? <FinalEvaluationCopy data={data} /> : null}
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

function Prose({ children, muted }: { children: string; muted?: boolean }) {
  return (
    <p className={`max-w-[70ch] whitespace-pre-wrap break-words text-base leading-relaxed ${muted ? "mt-1 text-muted" : "text-ink"}`} dir="auto">
      {children}
    </p>
  );
}

function BulletList({ title, items, muted }: { title?: string; items?: string[]; muted?: boolean }) {
  const list = Array.isArray(items) ? items.filter((x) => typeof x === "string" && x.trim()) : [];
  if (list.length === 0) return null;
  return (
    <div>
      {title ? <h4 className="mb-1.5 text-sm font-semibold text-muted">{title}</h4> : null}
      <ul className={`max-w-[70ch] list-disc space-y-1.5 ps-5 text-base leading-relaxed marker:text-subtle ${muted ? "text-muted" : "text-ink"}`}>
        {list.map((x, i) => (
          <li key={i} className="break-words" dir="auto">
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
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
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
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setCopied("idle");
          setOpen(true);
        }}
      >
        צפייה בטיוטה והעתקה
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="טיוטת חוות דעת סוף" className="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-muted">טיוטה בלבד — אינה חוות דעת רשמית ואינה קובעת כשירות. אפשר להעתיק ולערוך במסמך חיצוני.</p>
          <div className="max-h-[50vh] space-y-3 overflow-y-auto rounded-lg border border-line bg-canvas p-4 text-base leading-relaxed text-ink">
            <p className="whitespace-pre-wrap break-words" dir="auto">{fe.overallEvaluation}</p>
            <p className="text-muted">
              המלצת כשירות (המלצה בלבד): {READINESS_LABELS[fe.readiness.recommendation] ?? "—"}
              {fe.readiness.reasoning ? ` — ${fe.readiness.reasoning}` : ""}
            </p>
            <BulletList title="דגשים למפקדים" items={fe.commanderNotes} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span role="status" className="me-auto text-sm text-muted">
              {copied === "done" ? "הטקסט הועתק." : copied === "failed" ? "ההעתקה נכשלה — סמנו את הטקסט והעתיקו ידנית." : ""}
            </span>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              סגירה
            </Button>
            <Button type="button" onClick={copy}>
              העתקה
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
