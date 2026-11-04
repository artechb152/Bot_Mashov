"use client";

import { useState } from "react";
import { ChevronDown, Paperclip } from "lucide-react";
import { cn } from "@/lib/cn";
import { FEEDBACK_TYPE_LABELS } from "@/lib/domain/types";
import { FeedbackSourceToggle } from "./FeedbackSourceToggle";
import type { FeedbackDTO } from "@/lib/data/feedback";

/**
 * Scannable feedback history. Each entry is ONE row by default (title, then a meta
 * line: type · date · file kind) with the AI-source checkbox at the inline-end;
 * activating the row expands it in place to show the full text, file details and the
 * edit / archive actions. rawText is never shown in the collapsed row.
 * Presentational + callback-driven.
 */

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "2-digit" });
  } catch {
    return "";
  }
}

function sourceKind(f: FeedbackDTO): string | null {
  if (!f.attachment) return null;
  const m = f.attachment.mimeType;
  if (m.includes("pdf")) return "PDF";
  if (m.includes("word") || f.attachment.originalFileName.toLowerCase().endsWith(".docx")) return "DOCX";
  return "קובץ";
}

const ACTION_CLASS =
  "inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus";

export function FeedbackList({
  items,
  selectedIds,
  onToggleSource,
  onEdit,
  onArchive,
  showSourceToggle = false,
  canModify = false,
  emptyLabel = "אין עדיין משובים.",
  archiveLabel = "העברה לארכיון",
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
    return <p className="rounded-lg border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
      {items.map((f) => {
        const open = openId === f.id;
        const kind = sourceKind(f);
        const detailId = `fb-detail-${f.id}`;
        return (
          <li key={f.id} className="ws-row-enter">
            <div className="flex items-stretch gap-1 pe-2">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : f.id)}
                aria-expanded={open}
                aria-controls={detailId}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-start transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus"
              >
                <ChevronDown
                  className={cn("h-4 w-4 shrink-0 text-subtle transition-transform duration-150", open && "rotate-180")}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.9375rem] font-medium text-ink" dir="auto">
                    {f.title || FEEDBACK_TYPE_LABELS[f.feedbackType]}
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-subtle">
                    <span>{FEEDBACK_TYPE_LABELS[f.feedbackType]}</span>
                    {f.createdAt ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <time dateTime={f.createdAt} className="tabular-nums">{formatDate(f.createdAt)}</time>
                      </>
                    ) : null}
                    {kind ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                          {kind}
                        </span>
                      </>
                    ) : null}
                  </span>
                </span>
              </button>
              {showSourceToggle && onToggleSource ? (
                <FeedbackSourceToggle
                  checked={selectedIds ? selectedIds.has(f.id) : true}
                  onChange={(checked) => onToggleSource(f.id, checked)}
                  itemLabel={f.title}
                />
              ) : null}
            </div>

            {open ? (
              <div id={detailId} className="space-y-3 border-t border-line bg-canvas px-4 py-4">
                {f.authorName ? <p className="text-sm text-subtle">נכתב על ידי {f.authorName}</p> : null}
                {f.rawText ? (
                  <p className="max-w-[70ch] whitespace-pre-wrap break-words text-base leading-relaxed text-ink" dir="auto">
                    {f.rawText}
                  </p>
                ) : null}

                {f.attachment ? (
                  <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm">
                    <p className="font-medium text-ink" dir="auto">{f.attachment.originalFileName}</p>
                    <p className="mt-0.5 text-muted">
                      {kind} · {Math.max(1, Math.round(f.attachment.size / 1024))} KB
                    </p>
                    {!f.attachment.hasText ? (
                      <p className="mt-1 text-warn">לא חולץ טקסט מהקובץ — לא ניתן להשתמש בו כמקור לעוזר.</p>
                    ) : null}
                  </div>
                ) : null}

                {f.selectedAction ? <p className="text-sm text-muted">פעולה נבחרת: {f.selectedAction}</p> : null}

                {canModify && (onEdit || onArchive) ? (
                  <div className="-mb-1 flex flex-wrap justify-end gap-1">
                    {onEdit ? (
                      <button type="button" onClick={() => onEdit(f)} className={ACTION_CLASS}>
                        עריכה
                      </button>
                    ) : null}
                    {onArchive ? (
                      <button type="button" onClick={() => onArchive(f)} className={ACTION_CLASS}>
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
