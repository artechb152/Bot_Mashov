"use client";

import { useRef, useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import { EMPTY_FEEDBACK_DRAFT, FeedbackComposer, FeedbackList, isDraftDirty } from "@/components/feedback";
import type { SaveResult } from "@/components/feedback";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, type FeedbackType } from "@/lib/domain/types";
import { useWorkspace } from "./WorkspaceProvider";
import type { FeedbackDTO, FeedbackInput } from "@/lib/data/feedback";

const DISCARD_DRAFT = "למחוק את טיוטת המשוב? התוכן שכתבתם לא יישמר.";

/**
 * The selected trainee's feedback view, at full work-area width: the composer (when
 * open), the history with per-entry AI-source checkboxes, and the archive. The draft
 * lives in the provider, keyed by trainee, so switching trainees, tabs or panels never
 * discards it; it is cleared only after a confirmed save or an explicit, confirmed cancel.
 */
export function FeedbackPanel() {
  const {
    selectedTraineeId,
    feedback,
    archivedFeedback,
    selectedFeedbackIdSet,
    selectedSourceCount,
    loading,
    showArchived,
    composerFocusSignal,
    composerOpen,
    drafts,
    setDraft,
    openComposer,
    closeComposer,
    addFeedback,
    editFeedback,
    archiveFeedbackEntry,
    restoreFeedbackEntry,
    toggleSource,
    setShowArchived,
  } = useWorkspace();
  const [editing, setEditing] = useState<FeedbackDTO | null>(null);

  if (!selectedTraineeId) return null;
  const traineeId = selectedTraineeId;
  const draft = drafts[traineeId] ?? EMPTY_FEEDBACK_DRAFT;
  const activeCount = feedback.filter((f) => f.status === "active").length;

  async function save(input: Parameters<typeof addFeedback>[0]): Promise<SaveResult> {
    const result = await addFeedback(input);
    // Clear only the draft of the trainee it was written for, and only on success.
    if (result.ok) {
      setDraft(traineeId, null);
      closeComposer();
    }
    return result;
  }

  function cancel() {
    if (isDraftDirty(draft) && !window.confirm(DISCARD_DRAFT)) return;
    closeComposer();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {composerOpen ? (
        <section aria-labelledby="ws-composer-title" className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h3 id="ws-composer-title" className="mb-4 text-base font-semibold text-ink">
            משוב חדש
          </h3>
          <FeedbackComposer
            key={traineeId}
            idPrefix={`fb-${traineeId}`}
            draft={draft}
            onChange={(next) => setDraft(traineeId, next)}
            onSubmit={save}
            onCancel={cancel}
            submitting={loading.feedback}
            focusSignal={composerFocusSignal}
          />
        </section>
      ) : null}

      <section aria-labelledby="ws-history-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div>
            <h3 id="ws-history-title" className="text-base font-semibold text-ink">
              היסטוריית משובים
            </h3>
            {activeCount > 0 ? (
              <p className="mt-0.5 text-sm text-muted">
                {selectedSourceCount} מתוך {activeCount} מסומנים כמקור לעוזר ולסקירה
              </p>
            ) : null}
          </div>
          {!composerOpen ? (
            <Button variant="secondary" size="sm" onClick={openComposer}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              משוב חדש
            </Button>
          ) : null}
        </div>

        {loading.trainee ? (
          <p className="text-sm text-muted">טוען משובים…</p>
        ) : (
          <FeedbackList
            items={feedback}
            selectedIds={selectedFeedbackIdSet}
            showSourceToggle
            onToggleSource={toggleSource}
            canModify
            onEdit={setEditing}
            onArchive={(f) => archiveFeedbackEntry(f.id)}
            emptyLabel="אין עדיין משובים לחניך זה. משוב ראשון יאפשר להפיק סקירה."
          />
        )}
      </section>

      <section className="border-t border-line pt-4">
        <button
          type="button"
          onClick={() => setShowArchived(!showArchived)}
          aria-expanded={showArchived}
          className="-ms-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
        >
          <ChevronLeft className={cn("h-4 w-4 transition-transform duration-150", showArchived && "-rotate-90")} aria-hidden="true" />
          ארכיון משובים
        </button>
        {showArchived ? (
          <div className="mt-3">
            {loading.archived ? (
              <p className="text-sm text-muted">טוען…</p>
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
      </section>

      <EditFeedbackDialog entry={editing} onClose={() => setEditing(null)} onSave={editFeedback} />
    </div>
  );
}

/** Edit modal for one entry. Stays open (with the edits) when the save fails. */
function EditFeedbackDialog({
  entry,
  onClose,
  onSave,
}: {
  entry: FeedbackDTO | null;
  onClose: () => void;
  onSave: (id: string, input: Partial<FeedbackInput>) => Promise<SaveResult>;
}) {
  // The form reports whether it holds unsaved edits so closing can confirm first.
  const dirtyRef = useRef(false);
  const requestClose = () => {
    if (dirtyRef.current && !window.confirm("לסגור בלי לשמור את השינויים?")) return;
    dirtyRef.current = false;
    onClose();
  };
  return (
    <Dialog open={Boolean(entry)} onClose={requestClose} title="עריכת משוב" className="max-w-xl">
      {entry ? (
        <EditForm
          key={entry.id}
          entry={entry}
          onCancel={requestClose}
          onDirtyChange={(d) => {
            dirtyRef.current = d;
          }}
          onSave={async (input) => {
            const result = await onSave(entry.id, input);
            if (result.ok) {
              dirtyRef.current = false;
              onClose();
            }
            return result;
          }}
        />
      ) : null}
    </Dialog>
  );
}

function EditForm({
  entry,
  onCancel,
  onDirtyChange,
  onSave,
}: {
  entry: FeedbackDTO;
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSave: (input: Partial<FeedbackInput>) => Promise<SaveResult>;
}) {
  const [title, setTitle] = useState(entry.title);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(entry.feedbackType);
  const [rawText, setRawText] = useState(entry.rawText);
  const [selectedAction, setSelectedAction] = useState(entry.selectedAction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFile = Boolean(entry.attachment);

  const dirty =
    title !== entry.title || feedbackType !== entry.feedbackType || rawText !== entry.rawText || selectedAction !== entry.selectedAction;
  onDirtyChange(dirty);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) {
      setError("כותרת היא שדה חובה.");
      return;
    }
    if (!isFile && !rawText.trim()) {
      setError("תוכן המשוב הוא שדה חובה.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await onSave({ title: title.trim(), feedbackType, rawText: rawText.trim(), selectedAction: selectedAction.trim() });
      if (!result.ok) setError(`${result.error} השינויים נשארו בטופס — אפשר לנסות שוב.`);
    } catch {
      setError("עדכון המשוב נכשל. השינויים נשארו בטופס — אפשר לנסות שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate aria-busy={saving}>
      {error ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Field label="כותרת" htmlFor="edit-fb-title" required>
        <Input id="edit-fb-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} dir="auto" />
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
      <Field label={isFile ? "הערה" : "תוכן המשוב"} htmlFor="edit-fb-text" required={!isFile} hint={isFile ? "לא חובה" : undefined}>
        <Textarea id="edit-fb-text" rows={7} value={rawText} onChange={(e) => setRawText(e.target.value)} disabled={saving} dir="auto" />
      </Field>
      <Field label="פעולה נבחרת" htmlFor="edit-fb-action" hint="לא חובה">
        <Input id="edit-fb-action" value={selectedAction} onChange={(e) => setSelectedAction(e.target.value)} disabled={saving} dir="auto" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          ביטול
        </Button>
        <Button type="submit" disabled={saving || !dirty}>
          {saving ? "שומר…" : "שמירת שינויים"}
        </Button>
      </div>
    </form>
  );
}
