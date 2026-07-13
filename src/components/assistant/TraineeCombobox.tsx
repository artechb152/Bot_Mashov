"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, User, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { TraineeDTO } from "@/lib/data/trainees";

const NO_TRAINEE_LABEL = "ללא חניך";

type TraineeComboboxProps = {
  trainees: TraineeDTO[];
  /** Selected trainee id, or "" for no linked trainee. */
  value: string;
  onChange: (id: string) => void;
  /** Optional id for the trigger button (so an external <label htmlFor> can point at it). */
  id?: string;
};

function traineeMeta(trainee: TraineeDTO): string {
  return trainee.team ? `צוות ${trainee.team}` : "";
}

/**
 * A lightweight, self-contained combobox for linking a trainee to the bot
 * conversation. Linking is optional — the default is "ללא חניך מקושר". The
 * dropdown includes a search field so long trainee lists stay usable. Built
 * with React state + Tailwind (no external dependency).
 */
export function TraineeCombobox({ trainees, value, onChange, id }: TraineeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = trainees.find((t) => t.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trainees;
    return trainees.filter((t) => t.fullName.toLowerCase().includes(q));
  }, [trainees, query]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  // Focus the search field when the menu opens.
  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery("");
  }, [open]);

  function select(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "flex h-10 w-full items-center gap-2 rounded-lg border border-line-strong bg-surface ps-3 pe-9 text-sm text-ink transition-colors",
          "focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15",
        )}
      >
        <User className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
        <span className={cn("truncate", !selected && "text-muted")}>
          {selected ? selected.fullName : NO_TRAINEE_LABEL}
        </span>
      </button>

      {/* End adornment — a real sibling button (not nested inside the trigger). */}
      {selected ? (
        <button
          type="button"
          aria-label="ניקוי בחירת חניך"
          onClick={() => onChange("")}
          className="absolute inset-y-0 end-2 my-auto grid h-6 w-6 place-items-center rounded-md text-subtle transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <ChevronDown
          className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-subtle"
          aria-hidden="true"
        />
      )}

      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-line-strong bg-surface shadow-lg">
          <div className="border-b border-line p-2">
            <div className="flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-2">
              <Search className="h-4 w-4 shrink-0 text-subtle" aria-hidden="true" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
                placeholder="חיפוש חניך…"
                className="w-full bg-transparent text-sm text-ink placeholder:text-subtle focus:outline-none"
              />
            </div>
          </div>

          <ul role="listbox" className="max-h-60 overflow-y-auto p-1">
            <li>
              <button
                type="button"
                role="option"
                aria-selected={!selected}
                onClick={() => select("")}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm text-ink transition-colors hover:bg-surface-2",
                  !selected && "bg-surface-2",
                )}
              >
                <span className="flex-1 truncate text-muted">{NO_TRAINEE_LABEL}</span>
                {!selected && <Check className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />}
              </button>
            </li>

            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-sm text-muted">לא נמצאו חניכים</li>
            ) : (
              filtered.map((t) => {
                const isSelected = t.id === value;
                const meta = traineeMeta(t);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => select(t.id)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm transition-colors hover:bg-surface-2",
                        isSelected && "bg-surface-2",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-ink">{t.fullName}</span>
                        {meta && <span className="block truncate text-xs text-muted">{meta}</span>}
                      </span>
                      {isSelected && (
                        <Check className="h-4 w-4 shrink-0 text-ink" aria-hidden="true" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
