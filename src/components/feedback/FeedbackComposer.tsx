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

const ACCEPT = ".pdf,.docx,.txt,.md,.csv";

/**
 * Standalone "add feedback" form. Presentational + callback-driven: the PARENT owns
 * the API call. A feedback entry has a required TITLE and is either TEXT or a FILE
 * (PDF / DOCX / TXT) — a short note may accompany a file. AI drafting ("polish") is
 * NOT here anymore; it lives in the assistant panel.
 */
export function FeedbackComposer({
  onSubmit,
  submitting = false,
  error = null,
  focusSignal = 0,
  className,
}: {
  onSubmit: (input: FeedbackComposerInput) => boolean | Promise<boolean>;
  submitting?: boolean;
  error?: string | null;
  /** Increment to move keyboard focus into the title field. */
  focusSignal?: number;
  className?: string;
}) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [title, setTitle] = useState("");
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("lesson");
  const [rawText, setRawText] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal > 0) titleRef.current?.focus();
  }, [focusSignal]);

  function reset() {
    setTitle("");
    setRawText("");
    setSelectedAction("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);
    if (!title.trim()) {
      setLocalError("כותרת היא שדה חובה.");
      return;
    }
    if (mode === "text" && !rawText.trim()) {
      setLocalError("תוכן המשוב הוא שדה חובה.");
      return;
    }
    if (mode === "file" && !file) {
      setLocalError("יש לבחור קובץ.");
      return;
    }
    try {
      const saved = await onSubmit({
        feedbackType,
        title: title.trim(),
        rawText: rawText.trim(),
        selectedAction: selectedAction.trim(),
        file: mode === "file" ? file : null,
      });
      // Keep the user's draft (including the selected file) if the server rejected
      // the save. A failed mutation reports its error in the workspace banner.
      if (saved) reset();
    } catch {
      // Also protect against callbacks that unexpectedly reject.
      setLocalError("שמירת המשוב נכשלה. התוכן נשמר בטופס — נסו שוב.");
    }
  }

  const shownError = error ?? localError;

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-3", className)} noValidate>
      {shownError ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger">
          {shownError}
        </p>
      ) : null}

      <Field label="כותרת" htmlFor="fb-title" required>
        <Input id="fb-title" ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} disabled={submitting} placeholder="לדוגמה: התנסות הדרכה ראשונה" />
      </Field>

      <Field label="סוג המשוב" htmlFor="fb-type">
        <Select id="fb-type" value={feedbackType} onChange={(e) => setFeedbackType(e.target.value as FeedbackType)} disabled={submitting}>
          {FEEDBACK_TYPES.map((t) => (
            <option key={t} value={t}>
              {FEEDBACK_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>

      {/* Text / file toggle */}
      <div className="inline-flex rounded-lg border border-line-strong p-0.5 text-sm">
        {(["text", "file"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            disabled={submitting}
            className={cn(
              "rounded-md px-3 py-1 font-medium transition-colors",
              mode === m ? "bg-slate-900 text-white" : "text-muted hover:text-ink",
            )}
          >
            {m === "text" ? "טקסט" : "קובץ"}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <Field label="תוכן המשוב" htmlFor="fb-text" required>
          <Textarea id="fb-text" rows={4} value={rawText} onChange={(e) => setRawText(e.target.value)} disabled={submitting} placeholder="כתבו כאן…" />
        </Field>
      ) : (
        <div className="space-y-2">
          <input
            ref={fileRef}
            id="fb-file"
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={submitting}
            className="block w-full text-sm text-muted file:me-3 file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-2"
          />
          {file ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <FileUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label="הסרת הקובץ" className="text-subtle hover:text-ink">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </p>
          ) : (
            <p className="text-xs text-subtle">PDF, DOCX או TXT · עד 10MB · הטקסט ייחלץ אוטומטית לשימוש ה-AI.</p>
          )}
          <Textarea rows={2} value={rawText} onChange={(e) => setRawText(e.target.value)} disabled={submitting} placeholder="הערה קצרה (אופציונלי)" aria-label="הערה קצרה" />
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? "שומר…" : "הוספת משוב"}
        </Button>
      </div>
    </form>
  );
}
