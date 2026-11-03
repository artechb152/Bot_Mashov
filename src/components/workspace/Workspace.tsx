"use client";

import { X } from "lucide-react";
import { WorkspaceProvider, useWorkspace, type AIStatus } from "./WorkspaceProvider";
import { TraineeListPanel } from "./TraineeListPanel";
import { TraineeOverviewPanel } from "./TraineeOverviewPanel";
import { AssistantPanel } from "./AssistantPanel";
import type { TraineeDTO } from "@/lib/data/trainees";

/**
 * The /workspace client root. Full-height, RTL. The WORK AREA (trainee list + review)
 * is the wide, primary zone (~70-75%); the assistant is a NARROWER column on the left
 * (~25-30%), useful for chat but never dominating the screen. On a narrow viewport the
 * three zones stack (list → review → assistant) and the page scrolls vertically — never
 * horizontally. All shared state lives in the WorkspaceProvider.
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
      <div className="flex h-full flex-col overflow-y-auto bg-canvas lg:overflow-hidden" dir="rtl">
        <h1 className="sr-only">מרחב עבודה — חניכים, משובים, סקירה ובוט</h1>
        <ErrorBanner />
        <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
          {/* Work area — the wide, primary zone: trainee list (right) + review (left). */}
          <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row">
            {/* Right (inline-start in RTL): trainee list */}
            <div className="border-b border-line lg:min-h-0 lg:w-[300px] lg:shrink-0 lg:border-b-0 lg:border-e xl:w-[340px]">
              <TraineeListPanel />
            </div>
            {/* Center/left: the review document — takes all remaining work-area width. */}
            <div className="min-h-[16rem] lg:min-h-0 lg:flex-1">
              <TraineeOverviewPanel />
            </div>
          </div>
          {/* Left: assistant — a narrower column (~28%), stacks below on narrow viewports. */}
          <div className="lg:min-h-0 lg:w-[28%] lg:min-w-[19rem] lg:max-w-[30rem] lg:shrink-0">
            <AssistantPanel />
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}

/** A dismissible banner for transient, non-field errors (API/permission failures). */
function ErrorBanner() {
  const { error, dismissError } = useWorkspace();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 border-b border-danger-line bg-danger-surface px-4 py-2 text-sm text-danger"
    >
      <span className="min-w-0 break-words">{error}</span>
      <button
        type="button"
        onClick={dismissError}
        aria-label="סגירת ההודעה"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-danger transition-colors hover:bg-danger-line/40"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
