"use client";

import { useEffect, useRef, useState } from "react";
import { FileUp, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, type FeedbackType } from "@/lib/domain/types";

/** What the composer produces — text and/or an uploaded file. */
export type FeedbackComposerInput = {
  feedbackType: FeedbackType;
  title: string;
  rawText: string;
  selectedAction?: string;
  file?: File | null;
};

/** The in-progress form state. Owned by the parent so it survives re-mounts. */
export type FeedbackDraft = {
  mode: "text" | "file";
  title: string;
  feedbackType: FeedbackType;
  rawText: string;
  selectedAction: string;
  file: File | null;
};

/**
 * The result of a save attempt. Only `{ ok: true }` — a save the server confirmed —
 * lets the caller clear the form; any failure keeps every field (and the file).
 */
export type SaveResult = { ok: true } | { ok: false; error: string };

export const EMPTY_FEEDBACK_DRAFT: FeedbackDraft = {
  mode: "text",
  title: "",
  feedbackType: "lesson",
  rawText: "",
  selectedAction: "",
  file: null,
};

/** True when the draft holds anything the user typed or attached. */
export function isDraftDirty(d: FeedbackDraft | null | undefined): boolean {
  if (!d) return false;
  return Boolean(d.title.trim() || d.rawText.trim() || d.selectedAction.trim() || d.file);
}

const ACCEPT = ".pdf,.docx,.txt,.md,.csv";
const SAVE_FAILED = "שמירת המשוב נכשלה. התוכן נשאר בטופס — אפשר לנסות שוב.";

/**
 * The "new feedback" form. Controlled: the PARENT owns the draft (so switching
 * trainees or panels never discards it) and the API call. A feedback entry has a
 * required TITLE and is either TEXT or a FILE (PDF / DOCX / TXT) with an optional note.
 *
 * Save contract: `onSubmit` resolves to a {@link SaveResult}. The form is cleared by
 * the parent only after `{ ok: true }`; on `{ ok: false }` (or a thrown error) the
 * fields stay intact and the error is announced next to the form, with retry.
 */
export function FeedbackComposer({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitting = false,
  focusSignal = 0,
  idPrefix = "fb",
  className,
}: {
  draft: FeedbackDraft;
  onChange: (next: FeedbackDraft) => void;
  onSubmit: (input: FeedbackComposerInput) => Promise<SaveResult>;
  onCancel?: () => void;
  submitting?: boolean;
  /** Increment to move keyboard focus into the title field. */
  focusSignal?: number;
  idPrefix?: string;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const { mode, title, feedbackType, rawText, selectedAction, file } = draft;

  useEffect(() => {
    if (focusSignal > 0) titleRef.current?.focus();
  }, [focusSignal]);

  // The <input type=file> is uncontrolled — clear it when the draft drops the file.
  useEffect(() => {
    if (!file && fileRef.current) fileRef.current.value = "";
  }, [file]);

  const set = (patch: Partial<FeedbackDraft>) => {
    if (error) setError(null);
    onChange({ ...draft, ...patch });
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("כותרת היא שדה חובה.");
      titleRef.current?.focus();
      return;
    }
    if (mode === "text" && !rawText.trim()) {
      setError("תוכן המשוב הוא שדה חובה.");
      return;
    }
    if (mode === "file" && !file) {
      setError("יש לבחור קובץ.");
      return;
    }
    let result: SaveResult;
    try {
      result = await onSubmit({
        feedbackType,
        title: title.trim(),
        rawText: rawText.trim(),
        selectedAction: selectedAction.trim(),
        file: mode === "file" ? file : null,
      });
    } catch {
      // A callback that rejects instead of resolving is still a failed save.
      result = { ok: false, error: SAVE_FAILED };
    }
    if (!result.ok) {
      setError(result.error ? `${result.error} התוכן נשאר בטופס — אפשר לנסות שוב.` : SAVE_FAILED);
      requestAnimationFrame(() => errorRef.current?.focus());
    }
  }

  const id = (s: string) => `${idPrefix}-${s}`;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)} noValidate aria-busy={submitting}>
      {error ? (
        <p
          ref={errorRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger focus:outline-none"
        >
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field label="כותרת" htmlFor={id("title")} required>
          <Input
            id={id("title")}
            ref={titleRef}
            value={title}
            onChange={(e) => set({ title: e.target.value })}
            disabled={submitting}
            placeholder="לדוגמה: התנסות הדרכה ראשונה"
            dir="auto"
          />
        </Field>
        <Field label="סוג המשוב" htmlFor={id("type")}>
          <Select
            id={id("type")}
            value={feedbackType}
            onChange={(e) => set({ feedbackType: e.target.value as FeedbackType })}
            disabled={submitting}
          >
            {FEEDBACK_TYPES.map((t) => (
              <option key={t} value={t}>
                {FEEDBACK_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {/* Text / file — a segmented control (one is always selected). */}
      <div role="radiogroup" aria-label="אופן הזנת המשוב" className="inline-flex rounded-lg border border-line-strong bg-surface-2 p-1 text-sm">
        {(["text", "file"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => set({ mode: m })}
            disabled={submitting}
            className={cn(
              "h-9 rounded-md px-4 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
              mode === m ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {m === "text" ? "כתיבת טקסט" : "העלאת קובץ"}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <Field label="תוכן המשוב" htmlFor={id("text")} required>
          <Textarea
            id={id("text")}
            rows={8}
            value={rawText}
            onChange={(e) => set({ rawText: e.target.value })}
            disabled={submitting}
            placeholder="מה ראיתם, מה עבד, מה לשפר…"
            dir="auto"
            className="min-h-40 sm:text-base"
          />
        </Field>
      ) : (
        <div className="space-y-3">
          <Field label="קובץ" htmlFor={id("file")} required hint="PDF, DOCX או TXT · עד 10MB">
            <input
              ref={fileRef}
              id={id("file")}
              type="file"
              accept={ACCEPT}
              onChange={(e) => set({ file: e.target.files?.[0] ?? null })}
              disabled={submitting}
              className="block w-full text-sm text-muted file:me-3 file:h-10 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-4 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-2"
            />
          </Field>
          {file ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <FileUp className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate" dir="auto">{file.name}</span>
              <button
                type="button"
                onClick={() => set({ file: null })}
                aria-label={`הסרת הקובץ ${file.name}`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </p>
          ) : (
            <p className="text-sm text-subtle">הטקסט ייחלץ מהקובץ אוטומטית כדי שהעוזר יוכל להשתמש בו.</p>
          )}
          <Field label="הערה קצרה" htmlFor={id("note")} hint="לא חובה">
            <Textarea id={id("note")} rows={2} value={rawText} onChange={(e) => set({ rawText: e.target.value })} disabled={submitting} dir="auto" />
          </Field>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
            ביטול
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "שומר…" : "שמירת משוב"}
        </Button>
      </div>
    </form>
  );
}
