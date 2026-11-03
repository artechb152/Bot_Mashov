"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, Dialog, Field, Input, Textarea } from "@/components/ui";
import { KnowledgeMarkdown } from "@/components/knowledge/KnowledgeMarkdown";
import { useWorkspace, type ChatNotice } from "./WorkspaceProvider";
import { FEEDBACK_TYPES, FEEDBACK_TYPE_LABELS, type FeedbackType } from "@/lib/domain/types";
import type { AIArtifactTask } from "@/lib/ai/types";
import type { TurnDTO } from "@/lib/data/conversations";

/**
 * Bottom zone: a persistent (non-modal), collapsible + vertically-resizable assistant
 * panel wired to the Stage 2 chat/task APIs. Shows the active trainee + selected-source
 * count, a conversation switcher, opening suggestions, and — in development with the
 * Mock provider — a clear "מצב פיתוח · Mock" marker. It never renders a fabricated
 * answer: a not-configured/error result is shown as an explicit notice, not a bot reply.
 */

const MIN_HEIGHT = 180;
const DEFAULT_HEIGHT = 300;

type Suggestion =
  | { label: string; kind: "task"; task: AIArtifactTask }
  | { label: string; kind: "polish" };

// A slim set of the core actions (no scattered chips). The review is a single product
// ("הפק סקירה") rather than separate timeline/final-evaluation buttons.
const SUGGESTIONS: Suggestion[] = [
  { label: "נסח משוב", kind: "polish" },
  { label: "הפק סקירה", kind: "task", task: "trainee_overview" },
  { label: "סכם משובים", kind: "task", task: "feedback_summary" },
];

/** A polish result rendered in the chat with save-as-feedback actions. */
type PolishBubble = { id: string; text: string };

function storageKey(username: string, part: string): string {
  return `chp:ws:asst:${part}:${username}`;
}

export function AssistantPanel() {
  const ws = useWorkspace();
  const {
    username,
    ai,
    selectedTrainee,
    conversations,
    activeConversationId,
    turns,
    notices,
    selectedSourceCount,
    loading,
    selectConversation,
    startNewConversation,
    sendChat,
    runTask,
    polish,
    addFeedback,
  } = ws;

  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  // Wide (lg+) → the panel is a narrow LEFT column filling the row height; narrow → a
  // stacked, vertically-resizable strip below the work area. Vertical resize only
  // applies to the stacked layout (a side column takes its height from the row).
  const [isWide, setIsWide] = useState(false);
  const [input, setInput] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [polishBubbles, setPolishBubbles] = useState<PolishBubble[]>([]);
  const [polishing, setPolishing] = useState(false);
  const [polishNote, setPolishNote] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startY: number; startHeight: number } | null>(null);
  const polishSeq = useRef(0);

  // Restore persisted height/collapsed (per user).
  useEffect(() => {
    try {
      const h = Number(localStorage.getItem(storageKey(username, "h")));
      if (Number.isFinite(h) && h >= MIN_HEIGHT) setHeight(h);
      setCollapsed(localStorage.getItem(storageKey(username, "collapsed")) === "1");
    } catch {
      /* localStorage may be unavailable — fall back to defaults */
    }
    setHydrated(true);
  }, [username]);

  // Track the lg breakpoint (matches Tailwind's `lg`, 1024px) to switch layout mode.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsWide(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const persist = useCallback(
    (next: { height?: number; collapsed?: boolean }) => {
      try {
        if (next.height !== undefined) localStorage.setItem(storageKey(username, "h"), String(Math.round(next.height)));
        if (next.collapsed !== undefined) localStorage.setItem(storageKey(username, "collapsed"), next.collapsed ? "1" : "0");
      } catch {
        /* ignore persistence failures */
      }
    },
    [username],
  );

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, notices, loading.sending, loading.task, collapsed]);

  const onDragMove = useCallback((e: PointerEvent) => {
    const state = dragState.current;
    if (!state) return;
    const max = Math.round(window.innerHeight * 0.75);
    const next = Math.min(Math.max(state.startHeight + (state.startY - e.clientY), MIN_HEIGHT), max);
    setHeight(next);
  }, []);

  const onDragEnd = useCallback(() => {
    dragState.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
    setHeight((h) => {
      persist({ height: h });
      return h;
    });
  }, [onDragMove, persist]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragState.current = { startY: e.clientY, startHeight: height };
      window.addEventListener("pointermove", onDragMove);
      window.addEventListener("pointerup", onDragEnd);
    },
    [height, onDragMove, onDragEnd],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("pointermove", onDragMove);
      window.removeEventListener("pointerup", onDragEnd);
    };
  }, [onDragMove, onDragEnd]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      persist({ collapsed: !c });
      return !c;
    });
  }

  function handleKeyResize(e: React.KeyboardEvent) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      setHeight((h) => {
        const max = Math.round(window.innerHeight * 0.75);
        const next = Math.min(Math.max(h + (e.key === "ArrowUp" ? 24 : -24), MIN_HEIGHT), max);
        persist({ height: next });
        return next;
      });
    }
  }

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
      setPolishNote("כתבו הערות גולמיות בתיבה ואז לחצו „נסח משוב”.");
      return;
    }
    setPolishing(true);
    try {
      const res = await polish({ rawText: text, feedbackType: "other" });
      if (!res) return; // provider surfaced an error banner
      if (res.result.status === "ok") {
        polishSeq.current += 1;
        setPolishBubbles((prev) => [...prev, { id: `p${polishSeq.current}`, text: res.result.status === "ok" ? res.result.output.polishedText : "" }]);
        setInput("");
      } else {
        setPolishNote(res.result.message);
      }
    } finally {
      setPolishing(false);
    }
  }

  function onSuggestion(s: Suggestion) {
    if (!selectedTrainee) return;
    if (s.kind === "task") void runTask(s.task);
    else void runPolish();
  }

  const showSuggestions = selectedTrainee && turns.length === 0 && notices.length === 0 && polishBubbles.length === 0;

  return (
    <section
      className={cn(
        "flex flex-col bg-surface",
        isWide ? "h-full min-h-0 border-s border-line" : "shrink-0 border-t border-line",
      )}
      aria-label="עוזר AI"
    >
      {/* Resize handle — only in the stacked layout (a side column sizes to the row). */}
      {!collapsed && !isWide ? (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="שינוי גובה פאנל הבוט"
          tabIndex={0}
          onPointerDown={startDrag}
          onKeyDown={handleKeyResize}
          className="group flex h-2 cursor-row-resize items-center justify-center focus-visible:outline-none"
        >
          <span className="h-1 w-10 rounded-full bg-line-strong transition-colors group-hover:bg-subtle group-focus-visible:bg-slate-900" />
        </div>
      ) : null}

      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-2 pt-1">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">
            עוזר AI{selectedTrainee ? ` · ${selectedTrainee.fullName}` : ""}
          </span>
          {selectedTrainee ? (
            <span className="shrink-0 text-xs text-muted">{selectedSourceCount} מקורות מסומנים</span>
          ) : null}
          {ai.mock ? (
            <span className="shrink-0 rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted">
              מצב פיתוח · Mock
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {selectedTrainee && conversations.length > 0 ? (
            <select
              value={activeConversationId ?? ""}
              onChange={(e) => e.target.value && selectConversation(e.target.value)}
              aria-label="בחירת שיחה"
              className="max-w-[10rem] rounded-lg border border-line-strong bg-surface px-2 py-1 text-xs text-ink focus-visible:border-ink focus-visible:outline-none"
            >
              {activeConversationId ? null : <option value="">שיחה חדשה</option>}
              {conversations.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title || "שיחה"}
                </option>
              ))}
            </select>
          ) : null}
          {selectedTrainee ? (
            <button
              type="button"
              onClick={() => startNewConversation()}
              aria-label="שיחה חדשה"
              className="inline-flex h-7 items-center gap-1 rounded-lg border border-line-strong bg-surface px-2 text-xs text-ink transition-colors hover:bg-surface-2"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              שיחה חדשה
            </button>
          ) : null}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "פתיחת פאנל הבוט" : "כיווץ פאנל הבוט"}
            className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            {collapsed ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed ? (
        <div
          className={cn("flex min-h-0 flex-col", isWide && "flex-1")}
          style={isWide ? undefined : { height: hydrated ? height : DEFAULT_HEIGHT }}
        >
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {!selectedTrainee ? (
              <p className="grid h-full place-items-center text-center text-sm text-muted">
                בחרו חניך מהרשימה כדי לפתוח שיחה עם העוזר.
              </p>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-3">
                {!ai.configured ? (
                  <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
                    AI עדיין לא מחובר. אפשר לכתוב הערות ומשובים; תשובות העוזר יופעלו לאחר חיבור הספק.
                  </p>
                ) : null}

                {showSuggestions ? (
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => onSuggestion(s)}
                        disabled={loading.task !== null || loading.sending}
                        className="rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-xs text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
                      >
                        {s.label}
                      </button>
                    ))}
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
                  <div className="max-w-[85%] self-start rounded-2xl border border-line bg-surface-2 px-4 py-2.5 text-sm text-muted">{polishNote}</div>
                ) : null}
                {loading.sending || loading.task || polishing ? (
                  <div className="ws-row-enter self-start rounded-2xl border border-line bg-surface px-4 py-2 text-sm text-muted">…</div>
                ) : null}
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={submit} className="flex items-end gap-2 border-t border-line px-4 py-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  doSend();
                }
              }}
              rows={1}
              disabled={!selectedTrainee || loading.sending}
              placeholder={selectedTrainee ? "כתבו הודעה לעוזר, או הערות גולמיות ואז „נסח”…" : "בחרו חניך תחילה"}
              aria-label="הודעה לעוזר"
              className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-subtle focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 disabled:opacity-50"
            />
            {selectedTrainee ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void runPolish()}
                disabled={!input.trim() || polishing}
                aria-label="נסח משוב מההערות"
                className="h-11 shrink-0 rounded-xl"
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">נסח</span>
              </Button>
            ) : null}
            <Button type="submit" disabled={!selectedTrainee || !input.trim() || loading.sending} className="h-11 shrink-0 rounded-xl">
              <Send className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">שליחה</span>
            </Button>
          </form>
        </div>
      ) : null}

      <SavePolishAsFeedbackDialog
        text={saveTarget}
        onClose={() => setSaveTarget(null)}
        onSave={async (title, text, feedbackType) => {
          const okSaved = await addFeedback({ feedbackType, title, rawText: text });
          if (okSaved) {
            setSaveTarget(null);
            setPolishBubbles((prev) => prev.filter((p) => p.text !== text));
          }
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
    <div className="ws-row-enter max-w-[85%] self-start rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm text-ink">
      <p className="mb-1 text-xs font-medium text-muted">נוסח מוצע (AI) — לא נשמר עד לאישורכם:</p>
      <p className="whitespace-pre-wrap break-words leading-relaxed">{text}</p>
      <div className="mt-2 flex justify-end gap-3">
        <button type="button" onClick={copy} className="text-xs font-medium text-muted hover:text-ink">
          {copied ? "הועתק" : "העתק"}
        </button>
        <button type="button" onClick={onSave} className="text-xs font-medium text-brand-action hover:text-brand-action-hover">
          שמור כמשוב
        </button>
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
  onSave: (title: string, text: string, feedbackType: FeedbackType) => Promise<void>;
}) {
  return (
    <Dialog open={text !== null} onClose={onClose} title="שמירת נוסח כמשוב">
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
  onSave: (title: string, text: string, feedbackType: FeedbackType) => Promise<void>;
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
      await onSave(title.trim(), text.trim(), feedbackType);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
        המשוב נשמר רק לאחר אישור. אפשר לערוך את הנוסח לפני השמירה.
      </p>
      {err ? <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">{err}</p> : null}
      <Field label="כותרת" htmlFor="save-fb-title" required>
        <Input id="save-fb-title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving} />
      </Field>
      <Field label="סוג המשוב" htmlFor="save-fb-type">
        <select
          id="save-fb-type"
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value as FeedbackType)}
          disabled={saving}
          className="h-10 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus-visible:border-ink focus-visible:outline-none"
        >
          {FEEDBACK_TYPES.map((t) => (
            <option key={t} value={t}>
              {FEEDBACK_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="נוסח המשוב" htmlFor="save-fb-text" required>
        <Textarea id="save-fb-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} disabled={saving} />
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
        "max-w-[85%] break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
        isUser
          ? "self-end whitespace-pre-wrap bg-slate-900 text-white"
          : // The bot answers in Markdown — render it, trimming the outer block margins.
            "self-start border border-line bg-surface text-ink [&_div>*:first-child]:mt-0 [&_div>*:last-child]:mb-0",
      )}
    >
      {isUser ? turn.content : <KnowledgeMarkdown>{turn.content}</KnowledgeMarkdown>}
    </div>
  );
}

function NoticeBubble({ notice }: { notice: ChatNotice }) {
  const isError = notice.kind === "error";
  return (
    <div
      className={cn(
        "max-w-[85%] self-start rounded-2xl border px-4 py-2.5 text-sm leading-relaxed",
        isError ? "border-danger-line bg-danger-surface text-danger" : "border-line bg-surface-2 text-muted",
      )}
    >
      {notice.text}
    </div>
  );
}
