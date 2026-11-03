"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useUnsavedChangesGuard } from "@/lib/hooks/useUnsavedChangesGuard";
import { WorkspaceProvider, useWorkspace, type AIStatus, type MobilePane } from "./WorkspaceProvider";
import { TraineeListPanel } from "./TraineeListPanel";
import { TraineeWorkPanel } from "./TraineeWorkPanel";
import { AssistantPanel } from "./AssistantPanel";
import type { TraineeDTO } from "@/lib/data/trainees";

/**
 * The /workspace client root. Responsive zones (RTL — the rail is on the right):
 *
 *  - >=1536px: trainee rail · review (fluid, the widest zone) · assistant column
 *    (hideable). With the 256px app sidebar the review keeps >=600px.
 *  - 1024–1535px: trainee rail · review; the assistant opens as a drawer over the
 *    review's inline-end edge, so the review is never squeezed to fit a third column.
 *  - <1024px: one zone at a time, picked with a switcher (חניכים / חניך / עוזר);
 *    each zone has a single scroll container. Selecting a trainee jumps to it.
 *
 * All shared state lives in the WorkspaceProvider, so changing layout never resets it.
 */
export function Workspace({
  trainees,
  username,
  ai,
  initialTraineeId,
  initialCohortId,
}: {
  trainees: TraineeDTO[];
  username: string;
  ai: AIStatus;
  initialTraineeId?: string | null;
  initialCohortId?: string | null;
}) {
  return (
    <WorkspaceProvider
      trainees={trainees}
      username={username}
      ai={ai}
      initialTraineeId={initialTraineeId}
      initialCohortId={initialCohortId}
    >
      <WorkspaceLayout />
    </WorkspaceProvider>
  );
}

function WorkspaceLayout() {
  const { mobilePane, assistantOpen, dirtyDraftCount } = useWorkspace();
  // Unsaved feedback drafts survive trainee/cohort switches in memory; leaving the
  // work area (or reloading) asks first. Cohort links stay on /workspace → no prompt.
  useUnsavedChangesGuard(
    dirtyDraftCount > 0,
    "יש משוב שעדיין לא נשמר. לעזוב את מרחב העבודה? הטיוטה תימחק.",
    ["/workspace"],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <h1 className="sr-only">מרחב עבודה — חניכים, משובים, סקירה ועוזר</h1>
      <ErrorBanner />
      <MobileSwitcher />
      <div className="relative flex min-h-0 flex-1">
        <div
          className={cn(
            "min-h-0 w-full shrink-0 border-line lg:flex lg:w-64 lg:border-e xl:w-72",
            mobilePane === "list" ? "flex" : "hidden",
          )}
        >
          <TraineeListPanel />
        </div>
        <div className={cn("min-h-0 min-w-0 flex-1 lg:flex", mobilePane === "trainee" ? "flex" : "hidden")}>
          <TraineeWorkPanel />
        </div>
        <div
          id="ws-assistant"
          className={cn(
            "min-h-0 w-full",
            mobilePane === "assistant" ? "flex" : "hidden",
            // 1024–1535: an overlay drawer at the inline-end edge (left in RTL).
            "lg:absolute lg:inset-y-0 lg:end-0 lg:z-20 lg:w-[26rem] lg:max-w-[calc(100%-2rem)] lg:border-s lg:border-line lg:shadow-xl",
            assistantOpen ? "lg:flex" : "lg:hidden",
            // >=1536: a regular column beside the review.
            "2xl:static 2xl:z-auto 2xl:w-[24rem] 2xl:max-w-none 2xl:shrink-0 2xl:shadow-none",
          )}
        >
          <AssistantPanel />
        </div>
      </div>
    </div>
  );
}

const PANES: { id: MobilePane; label: string }[] = [
  { id: "list", label: "חניכים" },
  { id: "trainee", label: "חניך" },
  { id: "assistant", label: "עוזר AI" },
];

/** Below `lg`: a segmented switcher between the three zones (context is preserved). */
function MobileSwitcher() {
  const { mobilePane, setMobilePane, selectedTrainee, assistantBusy } = useWorkspace();
  return (
    <nav aria-label="אזורי מרחב העבודה" className="shrink-0 border-b border-line bg-surface px-3 py-2 lg:hidden">
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-1">
        {PANES.map((p) => {
          const active = mobilePane === p.id;
          const label = p.id === "trainee" && selectedTrainee ? selectedTrainee.fullName : p.label;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setMobilePane(p.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
                active ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              <span className="truncate" dir="auto">{label}</span>
              {p.id === "assistant" && assistantBusy ? (
                <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** A dismissible banner for transient, non-field errors (API/permission failures). */
function ErrorBanner() {
  const { error, dismissError } = useWorkspace();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex shrink-0 items-center justify-between gap-3 border-b border-danger-line bg-danger-surface py-1 pe-1 ps-4 text-sm text-danger"
    >
      <span className="min-w-0 break-words">{error}</span>
      <button
        type="button"
        onClick={dismissError}
        aria-label="סגירת ההודעה"
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-danger transition-colors hover:bg-danger-line/40"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
