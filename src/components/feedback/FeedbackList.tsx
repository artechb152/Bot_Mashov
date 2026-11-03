"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui";
import { FEEDBACK_TYPE_LABELS } from "@/lib/domain/types";
import { FeedbackSourceToggle } from "./FeedbackSourceToggle";
import type { FeedbackDTO } from "@/lib/data/feedback";

/**
 * Compact, scannable feedback list. Each entry is ONE row by default (title · date ·
 * type · source kind · AI-source toggle · minimal actions); clicking a row expands it
 * in place to show the full text / file details / metadata + edit & archive. rawText is
 * never shown in the collapsed row. Presentational + callback-driven for /workspace.
 */

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });
  } catch {
    return "";
  }
}

function sourceKind(f: FeedbackDTO): string {
  if (!f.attachment) return "טקסט";
  const m = f.attachment.mimeType;
  if (m.includes("pdf")) return "PDF";
  if (m.includes("word") || f.attachment.originalFileName.toLowerCase().endsWith(".docx")) return "DOCX";
  return "קובץ";
}

export function FeedbackList({
  items,
  selectedIds,
  onToggleSource,
  onEdit,
  onArchive,
  showSourceToggle = false,
  canModify = false,
  emptyLabel = "אין עדיין משובים.",
  archiveLabel = "ארכוב",
}: {
  items: FeedbackDTO[];
  selectedIds?: ReadonlySet<string>;
  onToggleSource?: (id: string, checked: boolean) => void;
  onEdit?: (item: FeedbackDTO) => void;
  onArchive?: (item: FeedbackDTO) => void;
  showSourceToggle?: boolean;
  canModify?: boolean;
  emptyLabel?: string;
  archiveLabel?: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (items.length === 0) {
    return <EmptyState title={emptyLabel} description="הוסיפו משוב ראשון כדי להתחיל." />;
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
      {items.map((f) => {
        const open = openId === f.id;
        const kind = sourceKind(f);
        return (
          <li key={f.id} className="ws-row-enter bg-surface">
            {/* Compact row */}
            <div className="flex items-center gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : f.id)}
                aria-expanded={open}
                className="flex min-w-0 flex-1 items-center gap-2 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900/15"
              >
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-subtle transition-transform", open && "rotate-180")}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {f.title || FEEDBACK_TYPE_LABELS[f.feedbackType]}
                </span>
                <span className="shrink-0 text-xs text-muted">{FEEDBACK_TYPE_LABELS[f.feedbackType]}</span>
                <span className="shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">{kind}</span>
                <span className="shrink-0 text-xs tabular-nums text-subtle">{formatDate(f.createdAt)}</span>
              </button>
              {showSourceToggle && onToggleSource ? (
                <FeedbackSourceToggle
                  checked={selectedIds ? selectedIds.has(f.id) : true}
                  onChange={(checked) => onToggleSource(f.id, checked)}
                  compact
                />
              ) : null}
            </div>

            {/* Expanded detail */}
            {open ? (
              <div className="ws-row-enter space-y-2 border-t border-line bg-surface-2/40 px-3 py-3">
                <p className="text-xs text-muted">{f.authorName || "—"}</p>
                {f.rawText ? (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">{f.rawText}</p>
                ) : null}

                {f.attachment ? (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs">
                    <p className="font-medium text-ink">{f.attachment.originalFileName}</p>
                    <p className="mt-0.5 text-muted">
                      {kind} · {Math.max(1, Math.round(f.attachment.size / 1024))} KB
                    </p>
                    {!f.attachment.hasText ? (
                      <p className="mt-1 text-warn">לא חולץ טקסט מהקובץ — אינו זמין כרגע כמקור AI.</p>
                    ) : null}
                  </div>
                ) : null}

                {f.selectedAction ? <p className="text-xs text-muted">פעולה: {f.selectedAction}</p> : null}

                {canModify && (onEdit || onArchive) ? (
                  <div className="flex justify-end gap-3 pt-1">
                    {onEdit ? (
                      <button type="button" onClick={() => onEdit(f)} className="text-xs font-medium text-muted transition-colors hover:text-ink focus-visible:underline focus-visible:outline-none">
                        עריכה
                      </button>
                    ) : null}
                    {onArchive ? (
                      <button type="button" onClick={() => onArchive(f)} className="text-xs font-medium text-muted transition-colors hover:text-ink focus-visible:underline focus-visible:outline-none">
                        {archiveLabel}
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
