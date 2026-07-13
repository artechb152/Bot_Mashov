"use client";

import { cn } from "@/lib/cn";

/**
 * Conversation contexts for the bot. These are NOT separate pages/routes — they
 * are single-select "modes" that frame the chat (which domain the commander is
 * consulting about). Exactly one is active at a time.
 */
export const CHAT_MODES = [
  { value: "simulations", label: "סימולציות" },
  { value: "lessons", label: "שיעורים" },
  { value: "final", label: "תרגול מסכם" },
  { value: "roleplay", label: "נע״ת" },
  { value: "feedback", label: "משובים" },
] as const;

export type ChatMode = (typeof CHAT_MODES)[number]["value"];

export const DEFAULT_CHAT_MODE: ChatMode = "lessons";

type ChatModePillsProps = {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
};

/**
 * Segmented single-select control (radio group) rendered as pills. Uses native
 * radio inputs (visually hidden) so keyboard/arrow-key selection works and only
 * one option can ever be active.
 */
export function ChatModePills({ value, onChange }: ChatModePillsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="תחום השיחה"
      className="inline-flex flex-wrap justify-center gap-1.5 rounded-2xl border border-line-strong bg-surface p-1.5"
    >
      {CHAT_MODES.map((mode) => {
        const active = mode.value === value;
        return (
          <label
            key={mode.value}
            className={cn(
              "cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors sm:px-6 sm:text-base",
              "focus-within:outline-none focus-within:ring-2 focus-within:ring-slate-900/20",
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            <input
              type="radio"
              name="chat-mode"
              value={mode.value}
              checked={active}
              onChange={() => onChange(mode.value)}
              className="sr-only"
            />
            {mode.label}
          </label>
        );
      })}
    </div>
  );
}
