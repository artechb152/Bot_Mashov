"use client";

import { useRef } from "react";
import Link from "next/link";
import { FileText, MessageSquareText, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, buttonClasses } from "@/components/ui";
import { COURSE_LABELS } from "@/lib/domain/types";
import { useWorkspace, type WorkspaceTab } from "./WorkspaceProvider";
import { TraineeReview } from "./TraineeReview";
import { FeedbackPanel } from "./FeedbackPanel";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "review", label: "סקירה" },
  { id: "feedback", label: "משובים" },
];

/**
 * The main work zone for the selected trainee: a compact identity header with the
 * primary action ("משוב חדש") and the assistant toggle, then two views — the single
 * review document and the feedback history. One scroll container, full available
 * width; the review is never squeezed by side panels (see Workspace for widths).
 */
export function TraineeWorkPanel() {
  const {
    selectedTrainee,
    feedback,
    traineeAccessError,
    activeTab,
    setActiveTab,
    openComposer,
    assistantOpen,
    assistantBusy,
    toggleAssistant,
    setMobilePane,
    visibleTrainees,
  } = useWorkspace();
  const tabRefs = useRef<Record<WorkspaceTab, HTMLButtonElement | null>>({ review: null, feedback: null });

  if (!selectedTrainee) {
    return (
      <div className="grid h-full w-full place-items-center bg-canvas p-6">
        <div className="max-w-sm text-center">
          <h2 className="text-lg font-semibold text-ink">בחרו חניך כדי להתחיל</h2>
          <p className="mt-2 text-base leading-relaxed text-muted">
            {visibleTrainees.length > 0
              ? "כאן יוצגו הסקירה וההיסטוריה של החניך, ומכאן מתעדים משוב חדש."
              : "אין עדיין חניכים במחזור הזה. הוסיפו חניך ראשון מהרשימה."}
          </p>
          <Button variant="secondary" className="mt-5 lg:hidden" onClick={() => setMobilePane("list")}>
            לרשימת החניכים
          </Button>
        </div>
      </div>
    );
  }

  const activeCount = feedback.filter((f) => f.status === "active").length;

  function onTabKey(e: React.KeyboardEvent, current: WorkspaceTab) {
    // Arrow keys move between tabs (RTL: ArrowLeft = next).
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const i = TABS.findIndex((t) => t.id === current);
    const next = TABS[(i + (e.key === "ArrowLeft" ? 1 : TABS.length - 1)) % TABS.length].id;
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <section className="flex h-full min-h-0 w-full min-w-0 flex-col bg-canvas" aria-labelledby="ws-trainee-name">
      <header className="shrink-0 border-b border-line bg-surface px-4 pt-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2 id="ws-trainee-name" className="truncate text-xl font-semibold tracking-tight text-ink" dir="auto">
              {selectedTrainee.fullName}
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {COURSE_LABELS[selectedTrainee.courseType]}
              {selectedTrainee.team ? ` · ${selectedTrainee.team}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/trainees/${selectedTrainee.id}`}
              className={buttonClasses({ variant: "quiet", size: "sm" })}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              תיק חניך
            </Link>
            {/* The assistant is a drawer/column on wide screens; on phones it has its own tab. */}
            <Button
              variant="secondary"
              size="sm"
              onClick={toggleAssistant}
              aria-expanded={assistantOpen}
              aria-controls="ws-assistant"
              className="aria-expanded:border-ink aria-expanded:bg-selected max-lg:hidden"
            >
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              עוזר AI
              {assistantBusy ? (
                <span className="relative flex h-2 w-2">
                  <span className="sr-only">(בעבודה)</span>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
              ) : null}
            </Button>
            <Button size="sm" onClick={openComposer}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              משוב חדש
            </Button>
          </div>
        </div>

        <div role="tablist" aria-label="תצוגת החניך" className="-mb-px mt-3 flex gap-1">
          {TABS.map((t) => {
            const selected = activeTab === t.id;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`ws-tab-${t.id}`}
                aria-selected={selected}
                aria-controls="ws-tabpanel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveTab(t.id)}
                onKeyDown={(e) => onTabKey(e, t.id)}
                className={cn(
                  "inline-flex h-11 items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
                  selected ? "border-primary text-ink" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.label}
                {t.id === "feedback" && activeCount > 0 ? (
                  <span className="tabular-nums text-subtle">{activeCount}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </header>

      <div
        id="ws-tabpanel"
        role="tabpanel"
        aria-labelledby={`ws-tab-${activeTab}`}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 sm:px-6"
      >
        {traineeAccessError ? (
          <p className="mx-auto max-w-xl rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
            לא נמצא חניך מתאים, או שאין לך הרשאה לצפות בו.
          </p>
        ) : activeTab === "review" ? (
          <TraineeReview />
        ) : (
          // A feedback-edit dialog must never survive a change of trainee context.
          <FeedbackPanel key={selectedTrainee.id} />
        )}
      </div>
    </section>
  );
}
