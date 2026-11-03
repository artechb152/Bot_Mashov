"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui";
import { UserMenu } from "@/components/layout/UserMenu";
import { SettingsButton } from "@/components/layout/SettingsButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { TraineeCombobox } from "@/components/assistant/TraineeCombobox";
import type { TraineeDTO } from "@/lib/data/trainees";

/**
 * General-purpose greeting: the bot no longer asks the user to pick a focus area
 * up front (the five mode pills are gone). The user simply writes what they need,
 * and the future AI layer infers the intent from the message itself.
 */
const OPENING_MESSAGE =
  "שלום, אני בוט חניכה ומשוב. אפשר לכתוב לי בחופשיות מה נדרש — התייעצות, ניסוח משוב, ניתוח אירוע או הכנה לשיחה. אפשר לקשר חניך לשיחה, ואפשר גם להתייעץ בלי חניך.";

/** Max composer height before it scrolls internally (a few lines tall). */
const MAX_COMPOSER_HEIGHT = 200;

type ChatMessage = { role: "bot" | "user"; text: string };

type AssistantChatProps = {
  trainees: TraineeDTO[];
  /** Optional trainee id from the `?traineeId=` query param. */
  initialTraineeId?: string;
  /** Current user's name — shown in the work-bar user menu. */
  username: string;
};

export function AssistantChat({ trainees, initialTraineeId = "", username }: AssistantChatProps) {
  // `trainees` is already owner+course scoped server-side, so an id from the URL
  // that is not in this list (someone else's trainee, or the other course's) is
  // silently dropped rather than linked.
  const validInitial = trainees.some((t) => t.id === initialTraineeId) ? initialTraineeId : "";
  const [traineeId, setTraineeId] = useState(validInitial);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "bot", text: OPENING_MESSAGE }]);
  const [input, setInput] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep the latest message in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-grow the composer to fit its content, up to a max height. Only show an
  // inner scrollbar once the content actually exceeds that max (otherwise the
  // idle textarea would render scrollbar chrome).
  const resizeComposer = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const natural = el.scrollHeight;
    el.style.height = `${Math.min(natural, MAX_COMPOSER_HEIGHT)}px`;
    el.style.overflowY = natural > MAX_COMPOSER_HEIGHT ? "auto" : "hidden";
  }, []);

  // Recompute on content change and on viewport resize (line wrapping shifts).
  useEffect(() => {
    resizeComposer();
  }, [input, resizeComposer]);

  useEffect(() => {
    window.addEventListener("resize", resizeComposer);
    return () => window.removeEventListener("resize", resizeComposer);
  }, [resizeComposer]);

  function send() {
    const text = input.trim();
    if (!text) return;
    // Local only — nothing is sent to any service and nothing is persisted.
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
  }

  // File selection is LOCAL/UI only — nothing is uploaded, stored, or sent.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) setFiles((prev) => [...prev, ...picked]);
    e.target.value = ""; // let the same file be picked again later
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-canvas">
      {/* Accessible page heading — kept visually hidden so the chat has no big title bar. */}
      <h1 className="sr-only">בוט חניכה ומשוב</h1>

      {/* Single work bar. inline-start (right): notifications + user card. inline-end
          (left): the linked-trainee selector with the settings gear pinned at the very
          edge (§6/§7). pt-14 on mobile clears the fixed floating nav button. */}
      <div className="shrink-0 border-b border-line bg-surface px-4 pb-4 pt-14 sm:px-6 lg:pt-4">
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Notifications + user card — hug the inline-start (right, in RTL) edge. */}
          <div className="flex items-center justify-center gap-2 sm:justify-start">
            <NotificationBell />
            <UserMenu username={username} />
          </div>
          {/* Linked trainee (shrinks if tight) + settings gear pinned at the inline-end. */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
              <label
                htmlFor="bot-trainee"
                className="shrink-0 whitespace-nowrap text-xs font-medium text-muted"
              >
                חניך מקושר
              </label>
              <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
                <TraineeCombobox
                  id="bot-trainee"
                  trainees={trainees}
                  value={traineeId}
                  onChange={setTraineeId}
                />
              </div>
            </div>
            <SettingsButton />
          </div>
        </div>
      </div>

      {/* Conversation — bot on the right, user (מפקד) on the left (RTL) */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-4">
          {messages.map((m, i) => (
            <div
              key={i}
              className={cn(
                "max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-5 py-3 text-sm leading-relaxed sm:max-w-[85%]",
                m.role === "bot"
                  ? "self-start border border-line bg-surface text-ink"
                  : "self-end bg-ink text-white",
              )}
            >
              {m.text}
            </div>
          ))}
        </div>
      </div>

      {/* Composer — send (right) · textarea (center) · add-files (left) in RTL */}
      <div className="shrink-0 border-t border-line bg-surface px-4 py-4 sm:px-6">
        {/* Selected files — local/UI only, nothing is uploaded */}
        {files.length > 0 && (
          <ul className="mx-auto mb-2 flex w-full max-w-4xl flex-wrap gap-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1 pe-1 ps-2.5 text-xs text-ink"
              >
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-subtle" aria-hidden="true" />
                <span className="truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  aria-label={`הסרת ${file.name}`}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-subtle transition-colors hover:bg-surface hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="mx-auto flex w-full max-w-4xl items-end gap-2"
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={handleFileChange}
          />
          {/* Right (inline-start in RTL): send */}
          <Button
            type="submit"
            disabled={!input.trim()}
            aria-label="שליחה"
            className="h-12 shrink-0 rounded-xl px-4 sm:px-5"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">שליחה</span>
          </Button>
          {/* Center: textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            placeholder="כתוב הודעה לבוט..."
            aria-label="הודעה לבוט"
            className={cn(
              "max-h-[200px] min-h-[3rem] flex-1 resize-none overflow-hidden rounded-2xl border border-control bg-surface px-4 py-3 text-sm leading-relaxed text-ink",
              "placeholder:text-subtle transition-colors",
              "focus-visible:border-focus focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/25",
            )}
          />
          {/* Left (inline-end in RTL): add files (local only) */}
          <Button
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            aria-label="הוספת קבצים"
            className="h-12 shrink-0 rounded-xl px-4 sm:px-5"
          >
            <Paperclip className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">הוספת קבצים</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
