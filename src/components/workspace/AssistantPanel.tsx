"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus, Send, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog, Field, Input, Select, Textarea } from "@/components/ui";
import { KnowledgeMarkdown } from "@/components/knowledge/KnowledgeMarkdown";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import type { SaveResult } from "@/components/feedback";
import { useWorkspace, type ChatNotice } from "./WorkspaceProvider";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, type FeedbackType } from "@/lib/domain/types";
import type { AIArtifactTask } from "@/lib/ai/types";
import type { TurnDTO } from "@/lib/data/conversations";

/**
 * The assistant — a support tool beside the review, never the main surface. The same
 * instance renders as a column (>=1536px), a drawer over the review (1024–1535px) or
 * its own pane on phones (see Workspace). Shows the linked trainee + selected-source
 * count, a conversation switcher, opening suggestions, and — in development with the
 * Mock provider — a clear "מצב פיתוח · Mock" marker. It never renders a fabricated
 * answer: a not-configured/error result is shown as an explicit notice, not a reply.
 */

type Suggestion =
  | { label: string; kind: "task"; task: AIArtifactTask }
  | { label: string; kind: "polish" };

// A slim set of the core actions. The review is a single product ("הפקת סקירה").
const SUGGESTIONS: Suggestion[] = [
  { label: "ניסוח משוב", kind: "polish" },
  { label: "הפקת סקירה", kind: "task", task: "trainee_overview" },
  { label: "סיכום משובים", kind: "task", task: "feedback_summary" },
];

/** A polish result rendered in the chat with save-as-feedback actions. */
type PolishBubble = { id: string; text: string };

export function AssistantPanel() {
  const {
    ai,
    selectedTrainee,
    conversations,
    activeConversationId,
    turns,
    notices,
    selectedSourceCount,
    loading,
    assistantOpen,
    assistantIsColumn,
    closeAssistant,
    selectConversation,
    startNewConversation,
    sendChat,
    runTask,
    polish,
    addFeedback,
  } = useWorkspace();

  const [input, setInput] = useState("");
  const [polishBubbles, setPolishBubbles] = useState<PolishBubble[]>([]);
  const [polishNote, setPolishNote] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const polishSeq = useRef(0);
  const polishing = loading.polish;
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const isDrawer = isDesktop && !assistantIsColumn;
  const busy = loading.sending || loading.task !== null || polishing;

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, notices, polishBubbles, busy]);

  // Drawer (1024–1535px): focus moves in on open, Escape closes, and focus returns
  // to the toggle. The column and the phone pane are not overlays, so they don't.
  useEffect(() => {
    if (!isDrawer || !assistantOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      // A modal dialog above the drawer owns Escape.
      if (e.key === "Escape" && !document.querySelector("[aria-modal=true]")) closeAssistant();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused && document.contains(previouslyFocused)) previouslyFocused.focus();
    };
  }, [isDrawer, assistantOpen, closeAssistant]);

  function doSend() {
    const text = input.trim();
    if (!text || !selectedTrainee) return;
    setInput("");
    void sendChat(text);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    doSend();
  }

  async function runPolish() {
    const text = input.trim();
    setPolishNote(null);
    if (!text) {
      setPolishNote("כתבו הערות גולמיות בתיבה, ואז בחרו „ניסוח משוב”.");
      return;
    }
    const res = await polish({ rawText: text, feedbackType: "other" });
    if (!res) return; // the provider surfaced an error banner
    if (res.result.status === "ok") {
      polishSeq.current += 1;
      const polished = res.result.output.polishedText;
      setPolishBubbles((prev) => [...prev, { id: `p${polishSeq.current}`, text: polished }]);
      setInput("");
    } else {
      setPolishNote(res.result.message);
    }
  }

  function onSuggestion(s: Suggestion) {
    if (!selectedTrainee) return;
    if (s.kind === "task") void runTask(s.task);
    else void runPolish();
  }

  const showSuggestions = selectedTrainee && turns.length === 0 && notices.length === 0 && polishBubbles.length === 0;

  return (
    <section className="flex h-full min-h-0 w-full flex-col bg-surface" aria-labelledby="ws-assistant-title">
      {/* Header */}
      <div className="flex shrink-0 items-start gap-2 border-b border-line py-3 pe-2 ps-4">
        <div className="min-w-0 flex-1">
          <h2 id="ws-assistant-title" className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-ink">
            עוזר AI
            {ai.mock ? (
              <span className="rounded-md border border-line-strong px-1.5 text-xs font-medium text-muted">מצב פיתוח · Mock</span>
            ) : null}
          </h2>
          <p className="truncate text-sm text-muted">
            {selectedTrainee ? (
              <>
                על <span dir="auto">{selectedTrainee.fullName}</span> · {selectedSourceCount} משובים כמקור
              </>
            ) : (
              "לא נבחר חניך"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={closeAssistant}
          aria-label={assistantIsColumn ? "הסתרת העוזר" : "סגירת העוזר"}
          title={assistantIsColumn ? "הסתרת העוזר" : "סגירת העוזר"}
          className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:grid"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {selectedTrainee ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-2">
          {conversations.length > 0 ? (
            <div className="relative min-w-0 flex-1">
              <select
                value={activeConversationId ?? ""}
                onChange={(e) => e.target.value && selectConversation(e.target.value)}
                aria-label="בחירת שיחה"
                className="h-10 w-full appearance-none truncate rounded-lg border border-control bg-surface pe-8 ps-3 text-base text-ink focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25 sm:text-sm"
              >
                {activeConversationId ? null : <option value="">שיחה חדשה</option>}
                {conversations.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title || "שיחה ללא כותרת"}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute inset-y-0 end-2.5 my-auto h-4 w-4 text-subtle" aria-hidden="true" />
            </div>
          ) : (
            <p className="min-w-0 flex-1 text-sm text-subtle">אין עדיין שיחות</p>
          )}
          <Button variant="secondary" size="sm" onClick={() => startNewConversation()} className="shrink-0">
            <Plus className="h-4 w-4" aria-hidden="true" />
            שיחה חדשה
          </Button>
        </div>
      ) : null}

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4" aria-busy={busy}>
        {!selectedTrainee ? (
          <p className="grid h-full place-items-center text-center text-sm text-muted">בחרו חניך כדי לשוחח עם העוזר עליו.</p>
        ) : (
          <div className="flex flex-col gap-3" aria-live="polite">
            {!ai.configured ? (
              <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-muted">
                העוזר עדיין לא מחובר. אפשר לכתוב משובים כרגיל; תשובות יופעלו לאחר חיבור הספק.
              </p>
            ) : null}

            {showSuggestions ? (
              <div className="space-y-2">
                <p className="text-sm text-muted">אפשר להתחיל מאחת הפעולות:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <Button key={s.label} variant="secondary" size="sm" onClick={() => onSuggestion(s)} disabled={busy}>
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            {turns.map((t) => (
              <TurnBubble key={t.id} turn={t} />
            ))}
            {notices.map((n) => (
              <NoticeBubble key={n.id} notice={n} />
            ))}
            {polishBubbles.map((p) => (
              <PolishResultBubble key={p.id} text={p.text} onSave={() => setSaveTarget(p.text)} />
            ))}
            {polishNote ? (
              <div className="max-w-[90%] self-start rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-muted">{polishNote}</div>
            ) : null}
            {busy ? (
              <div className="ws-row-enter inline-flex items-center gap-2 self-start rounded-xl border border-line bg-surface px-4 py-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                {polishing ? "מנסח…" : loading.task ? "מפיק…" : "חושב…"}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="shrink-0 space-y-2 border-t border-line px-4 py-3">
        <label htmlFor="ws-assistant-input" className="sr-only">
          הודעה לעוזר
        </label>
        <textarea
          id="ws-assistant-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              doSend();
            }
          }}
          rows={2}
          aria-describedby="ws-assistant-hint"
          disabled={!selectedTrainee || loading.sending}
          placeholder={selectedTrainee ? "שאלה לעוזר, או הערות גולמיות לניסוח משוב" : "בחרו חניך תחילה"}
          dir="auto"
          className="max-h-40 min-h-[3.25rem] w-full resize-none rounded-lg border border-control bg-surface px-3 py-2.5 text-base leading-relaxed text-ink placeholder:text-subtle focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25 disabled:opacity-50 sm:text-sm"
        />
        <p id="ws-assistant-hint" className="sr-only">
          Enter לשליחה, Shift+Enter לשורה חדשה.
        </p>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            {selectedTrainee ? (
              <Button type="button" variant="secondary" size="sm" onClick={() => void runPolish()} disabled={!input.trim() || polishing}>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                ניסוח משוב
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={!selectedTrainee || !input.trim() || loading.sending}>
              <Send className="h-4 w-4 -scale-x-100" aria-hidden="true" />
              שליחה
            </Button>
          </div>
        </div>
      </form>

      <SavePolishAsFeedbackDialog
        text={saveTarget}
        onClose={() => setSaveTarget(null)}
        onSave={async (title, text, feedbackType) => {
          const result = await addFeedback({ feedbackType, title, rawText: text });
          if (result.ok) {
            setSaveTarget(null);
            setPolishBubbles((prev) => prev.filter((p) => p.text !== text));
          }
          return result;
        }}
      />
    </section>
  );
}

/** A polished draft shown in the chat — copy, or save as a feedback (with confirmation). */
function PolishResultBubble({ text, onSave }: { text: string; onSave: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div className="ws-row-enter max-w-[92%] self-start rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink">
      <p className="mb-1 text-sm font-medium text-muted">נוסח מוצע — לא נשמר עד שתאשרו:</p>
      <p className="whitespace-pre-wrap break-words text-base leading-relaxed" dir="auto">{text}</p>
      <div className="mt-2 flex flex-wrap justify-end gap-1">
        <Button variant="quiet" size="sm" onClick={copy}>
          {copied ? "הועתק" : "העתקה"}
        </Button>
        <Button variant="secondary" size="sm" onClick={onSave}>
          שמירה כמשוב
        </Button>
      </div>
    </div>
  );
}

function SavePolishAsFeedbackDialog({
  text,
  onClose,
  onSave,
}: {
  text: string | null;
  onClose: () => void;
  onSave: (title: string, text: string, feedbackType: FeedbackType) => Promise<SaveResult>;
}) {
  return (
    <Dialog open={text !== null} onClose={onClose} title="שמירת הנוסח כמשוב">
      {text !== null ? <SavePolishForm initialText={text} onClose={onClose} onSave={onSave} /> : null}
    </Dialog>
  );
}

function SavePolishForm({
  initialText,
  onClose,
  onSave,
}: {
  initialText: string;
  onClose: () => void;
  onSave: (title: string, text: string, feedbackType: FeedbackType) => Promise<SaveResult>;
}) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState(initialText);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("other");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setErr("כותרת היא שדה חובה.");
      return;
    }
    setErr(null);
    setSaving(true);
    try {
      const result = await onSave(title.trim(), text.trim(), feedbackType);
      if (!result.ok) setErr(`${result.error} הנוסח נשאר בטופס — אפשר לנסות שוב.`);
    } catch {
      setErr("שמירת המשוב נכשלה. הנוסח נשאר בטופס — אפשר לנסות שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate aria-busy={saving}>
      <p className="text-sm text-muted">המשוב נשמר רק לאחר אישור. אפשר לערוך את הנוסח לפני השמירה.</p>
      {err ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">
          {err}
        </p>
      ) : null}
      <Field label="כותרת" htmlFor="save-fb-title" required>
        <Input id="save-fb-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} dir="auto" />
      </Field>
      <Field label="סוג המשוב" htmlFor="save-fb-type">
        <Select id="save-fb-type" value={feedbackType} onChange={(e) => setFeedbackType(e.target.value as FeedbackType)} disabled={saving}>
          {FEEDBACK_TYPES.map((t) => (
            <option key={t} value={t}>
              {FEEDBACK_TYPE_LABELS[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="נוסח המשוב" htmlFor="save-fb-text" required>
        <Textarea id="save-fb-text" rows={7} value={text} onChange={(e) => setText(e.target.value)} disabled={saving} dir="auto" />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
          ביטול
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "שומר…" : "שמירה כמשוב"}
        </Button>
      </div>
    </form>
  );
}

function TurnBubble({ turn }: { turn: TurnDTO }) {
  const isUser = turn.role === "user";
  return (
    <div
      className={cn(
        "max-w-[92%] break-words rounded-xl px-4 py-2.5 text-[0.9375rem] leading-relaxed",
        isUser
          ? "self-end whitespace-pre-wrap bg-ink text-white"
          : // The bot answers in Markdown — render it, trimming the outer block margins.
            "self-start border border-line bg-surface text-ink [&_div>*:first-child]:mt-0 [&_div>*:last-child]:mb-0",
      )}
      dir="auto"
    >
      {isUser ? turn.content : <KnowledgeMarkdown>{turn.content}</KnowledgeMarkdown>}
    </div>
  );
}

function NoticeBubble({ notice }: { notice: ChatNotice }) {
  const isError = notice.kind === "error";
  return (
    <div
      role={isError ? "alert" : undefined}
      className={cn(
        "max-w-[92%] self-start rounded-xl border px-4 py-2.5 text-sm leading-relaxed",
        isError ? "border-danger-line bg-danger-surface text-danger" : "border-line bg-surface-2 text-muted",
      )}
    >
      {notice.text}
    </div>
  );
}
