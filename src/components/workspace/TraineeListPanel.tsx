"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { PenLine, Search, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState, buttonClasses } from "@/components/ui";
import { isDraftDirty } from "@/components/feedback";
import { useWorkspace } from "./WorkspaceProvider";
import type { TraineeDTO } from "@/lib/data/trainees";

function matches(t: TraineeDTO, q: string): boolean {
  return `${t.fullName} ${t.team ?? ""}`.toLocaleLowerCase("he").includes(q);
}

/**
 * The trainee rail: a searchable, scannable list of the current cohort's trainees.
 * Selecting a row opens that trainee in the work area (URL-synced by the provider);
 * nothing expands inline, so the rail keeps a stable height and position. A row
 * with an unsaved feedback draft is marked so switching away never hides work.
 */
export function TraineeListPanel() {
  const { visibleTrainees, selectedTraineeId, selectTrainee, drafts } = useWorkspace();
  const [query, setQuery] = useState("");
  const q = query.trim().toLocaleLowerCase("he");
  const results = useMemo(
    () => (q ? visibleTrainees.filter((t) => matches(t, q)) : visibleTrainees),
    [visibleTrainees, q],
  );
  const total = visibleTrainees.length;

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-surface" aria-labelledby="ws-trainees-title">
      <header className="space-y-3 border-b border-line px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="ws-trainees-title" className="text-base font-semibold text-ink">
            חניכים
            {total > 0 ? <span className="ms-1.5 text-sm font-normal tabular-nums text-subtle">{total}</span> : null}
          </h2>
          <Link
            href="/trainees/new"
            className={buttonClasses({ variant: "quiet", size: "sm", className: "-me-2" })}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            חניך חדש
          </Link>
        </div>
        {total > 0 ? (
          <div className="relative">
            <label htmlFor="ws-trainee-search" className="sr-only">
              חיפוש חניך
            </label>
            <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-subtle" aria-hidden="true" />
            <input
              id="ws-trainee-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.preventDefault();
                  setQuery("");
                }
              }}
              placeholder="חיפוש לפי שם או צוות"
              autoComplete="off"
              dir="auto"
              className="h-11 w-full rounded-lg border border-control bg-surface pe-10 ps-9 text-base text-ink placeholder:text-subtle focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25 sm:h-10 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="ניקוי החיפוש"
                className="absolute inset-y-0 end-0 grid w-10 place-items-center rounded-lg text-subtle transition-colors hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
        {/* Result count for screen readers (and sighted users while filtering). */}
        <p aria-live="polite" className={cn("text-sm text-subtle", !q && "sr-only")}>
          {q ? `${results.length} מתוך ${total} חניכים` : `${total} חניכים ברשימה`}
        </p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {total === 0 ? (
          <EmptyState
            className="m-2 py-10"
            title="אין חניכים במחזור הזה"
            description="הוסיפו חניך ראשון כדי להתחיל — משובים, סקירה וציר התפתחות."
            action={
              <Link href="/trainees/new" className={buttonClasses({ variant: "primary", size: "sm" })}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                הוספת חניך
              </Link>
            }
          />
        ) : results.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <p className="text-sm font-medium text-ink">לא נמצאו חניכים</p>
            <p className="mt-1 text-sm text-muted">אין התאמה ל״{query.trim()}״.</p>
            <button
              type="button"
              onClick={() => setQuery("")}
              className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4" })}
            >
              ניקוי החיפוש
            </button>
          </div>
        ) : (
          <ul className="space-y-0.5">
            {results.map((t) => {
              const isSelected = t.id === selectedTraineeId;
              const hasDraft = isDraftDirty(drafts[t.id]);
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => selectTrainee(t.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={cn(
                      "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus",
                      isSelected ? "bg-selected" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[0.9375rem] text-ink", isSelected ? "font-semibold" : "font-medium")} dir="auto">
                        {t.fullName}
                      </span>
                      {t.team ? <span className="block truncate text-sm text-subtle" dir="auto">{t.team}</span> : null}
                    </span>
                    {hasDraft ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-sm text-muted" title="יש טיוטת משוב שלא נשמרה">
                        <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
                        טיוטה
                        <span className="sr-only">— משוב שלא נשמר</span>
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
