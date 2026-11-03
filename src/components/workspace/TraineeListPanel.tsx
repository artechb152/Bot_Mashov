"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Minus, Plus, UserPlus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog, EmptyState, Field, Input, Select, Textarea, buttonClasses } from "@/components/ui";
import { FeedbackComposer, FeedbackList } from "@/components/feedback";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, type FeedbackType } from "@/lib/domain/types";
import { useWorkspace } from "./WorkspaceProvider";
import type { FeedbackDTO, FeedbackInput } from "@/lib/data/feedback";

/**
 * Right-hand zone: the scrollable trainee list. Each row selects the trainee (name)
 * and the "+" opens their feedback inline (no navigation). The expanded trainee shows
 * its feedback list (with per-entry "AI source" toggles), an add-feedback composer
 * (with optional AI drafting), and a collapsible archive.
 */
export function TraineeListPanel() {
  const ws = useWorkspace();
  const {
    visibleTrainees,
    selectedTraineeId,
    expandedTraineeId,
    selectTrainee,
    toggleExpand,
  } = ws;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label="רשימת החניכים">
      <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">
          חניכים {visibleTrainees.length > 0 ? <span className="text-subtle">({visibleTrainees.length})</span> : null}
        </h2>
        {visibleTrainees.length > 0 ? (
          <Link href="/trainees/new" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            חניך חדש
          </Link>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {visibleTrainees.length === 0 ? (
          <EmptyState
            title="אין חניכים להצגה"
            description="הוסיפו חניך ראשון כדי להתחיל לעבוד — משוב, סקירה וציר התפתחות."
            action={
              <Link href="/trainees/new" className={buttonClasses({ variant: "primary", size: "sm" })}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                הוספת חניך
              </Link>
            }
          />
        ) : (
          <ul className="space-y-1.5">
            {visibleTrainees.map((t) => {
              const isSelected = t.id === selectedTraineeId;
              const isExpanded = t.id === expandedTraineeId && isSelected;
              return (
                <li key={t.id}>
                  <div
                    className={cn(
                      "flex items-stretch gap-1 rounded-lg border transition-colors",
                      isSelected ? "border-line-strong bg-surface-2" : "border-transparent hover:bg-surface-2",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => selectTrainee(t.id)}
                      aria-current={isSelected ? "true" : undefined}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-3 py-2.5 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900"
                    >
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", isSelected ? "bg-slate-900" : "bg-line-strong")}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{t.fullName}</span>
                        {t.team ? <span className="block truncate text-xs text-muted">{t.team}</span> : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => (isSelected ? toggleExpand(t.id) : selectTrainee(t.id))}
                      aria-expanded={isExpanded}
                      aria-label={isExpanded ? `סגירת המשובים של ${t.fullName}` : `פתיחת המשובים של ${t.fullName}`}
                      className="grid w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900"
                    >
                      {isExpanded ? <Minus className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>

                  {isExpanded ? <ExpandedFeedback /> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/** The inline feedback area for the selected + expanded trainee. */
function ExpandedFeedback() {
  const ws = useWorkspace();
  const {
    feedback,
    archivedFeedback,
    selectedFeedbackIdSet,
    loading,
    traineeAccessError,
    showArchived,
    composerFocusSignal,
    addFeedback,
    editFeedback,
    archiveFeedbackEntry,
    restoreFeedbackEntry,
    toggleSource,
    setShowArchived,
  } = ws;

  const [editing, setEditing] = useState<FeedbackDTO | null>(null);

  if (traineeAccessError) {
    return (
      <div className="mt-1 rounded-lg border border-line bg-surface-2 p-3 text-sm text-muted">
        לא נמצא חניך מתאים, או שאין לך הרשאה לצפות בו.
      </div>
    );
  }

  if (loading.trainee) {
    return <div className="mt-1 px-3 py-4 text-sm text-muted">טוען משובים…</div>;
  }

  return (
    <div className="mt-1 space-y-4 rounded-lg border border-line bg-surface p-3">
      <FeedbackList
        items={feedback}
        selectedIds={selectedFeedbackIdSet}
        showSourceToggle
        onToggleSource={toggleSource}
        canModify
        onEdit={setEditing}
        onArchive={(f) => archiveFeedbackEntry(f.id)}
        emptyLabel="אין עדיין משובים לחניך זה."
      />

      {/* Archive (collapsible) */}
      <div className="border-t border-line pt-3">
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          className="flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-ink"
        >
          <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", showArchived && "-rotate-90")} aria-hidden="true" />
          משובים בארכיון
        </button>
        {showArchived ? (
          <div className="mt-2">
            {loading.archived ? (
              <p className="px-1 text-xs text-muted">טוען…</p>
            ) : archivedFeedback.length === 0 ? (
              <p className="px-1 text-xs text-subtle">אין משובים בארכיון.</p>
            ) : (
              <FeedbackList
                items={archivedFeedback}
                canModify
                onArchive={(f) => restoreFeedbackEntry(f.id)}
                archiveLabel="שחזור"
                emptyLabel="אין משובים בארכיון."
              />
            )}
          </div>
        ) : null}
      </div>

      {/* Add feedback */}
      <div className="border-t border-line pt-3">
        <p className="mb-2 text-xs font-semibold text-muted">הוספת משוב</p>
        <FeedbackComposer
          onSubmit={async (input) => {
            await addFeedback(input);
          }}
          submitting={loading.feedback}
          focusSignal={composerFocusSignal}
        />
      </div>

      <EditFeedbackDialog
        entry={editing}
        onClose={() => setEditing(null)}
        onSave={async (id, input) => {
          const ok = await editFeedback(id, input);
          if (ok) setEditing(null);
        }}
      />
    </div>
  );
}

/** Compact edit modal for a single feedback entry. */
function EditFeedbackDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: FeedbackDTO | null;
  onClose: () => void;
  onSave: (id: string, input: Partial<FeedbackInput>) => Promise<void>;
}) {
  return (
    <Dialog open={Boolean(entry)} onClose={onClose} title="עריכת משוב">
      {entry ? <EditForm key={entry.id} entry={entry} onClose={onClose} onSave={onSave} /> : null}
    </Dialog>
  );
}

function EditForm({
  entry,
  onClose,
  onSave,
}: {
  entry: FeedbackDTO;
  onClose: () => void;
  onSave: (id: string, input: Partial<FeedbackInput>) => Promise<void>;
}) {
  const [title, setTitle] = useState(entry.title);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(entry.feedbackType);
  const [rawText, setRawText] = useState(entry.rawText);
  const [selectedAction, setSelectedAction] = useState(entry.selectedAction);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const isFile = Boolean(entry.attachment);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setLocalError("כותרת היא שדה חובה.");
      return;
    }
    if (!isFile && !rawText.trim()) {
      setLocalError("תוכן המשוב הוא שדה חובה.");
      return;
    }
    setSaving(true);
    setLocalError(null);
    try {
      await onSave(entry.id, { title: title.trim(), feedbackType, rawText: rawText.trim(), selectedAction: selectedAction.trim() });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {localError ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger">
          {localError}
        </p>
      ) : null}
      <Field label="כותרת" htmlFor="edit-fb-title" required>
        <Input id="edit-fb-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
      </Field>
      <Field label="סוג המשוב" htmlFor="edit-fb-type">
        <Select id="edit-fb-type" value={feedbackType} onChange={(e) => setFeedbackType(e.target.value as FeedbackType)} disabled={saving}>
          {FEEDBACK_TYPES.map((t) => (
            <option key={t} value={t}>
              {FEEDBACK_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={isFile ? "הערה (אופציונלי)" : "תוכן המשוב"} htmlFor="edit-fb-text" required={!isFile}>
        <Textarea id="edit-fb-text" rows={5} value={rawText} onChange={(e) => setRawText(e.target.value)} disabled={saving} />
      </Field>
      <Field label="פעולה נבחרת (אופציונלי)" htmlFor="edit-fb-action">
        <Input id="edit-fb-action" value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} disabled={saving} />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          ביטול
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </form>
  );
}
