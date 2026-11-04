"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button, Panel, EmptyState } from "@/components/ui";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

/**
 * System updates list. Full page: a bordered list with "mark all as read". Inside the
 * updates popover (`compact`), the popover is the surface — the list renders flush, so
 * there is never a card inside a card. Unread items carry an action-blue dot plus an
 * equivalent screen-reader label (colour is never the only cue).
 */
export function NotificationsList({
  initial,
  onNavigate,
  compact = false,
}: {
  initial: Notif[];
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const [items, setItems] = useState(initial);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await fetch(`/api/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }

  async function markAll() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await fetch("/api/notifications/read-all", { method: "POST" }).catch(() => {});
  }

  const hasUnread = items.some((n) => !n.read);

  if (items.length === 0) {
    const empty = <EmptyState title="אין עדכונים" description="כאן יופיעו שינויי הרשאה, שיוך למחזור והודעות מערכת." className={compact ? "border-0 py-8" : undefined} />;
    return compact ? empty : <Panel>{empty}</Panel>;
  }

  const list = (
    <ul className="divide-y divide-line">
      {items.map((n) => {
        const inner = (
          <div className={cn("flex items-start gap-3 py-3", compact ? "px-3" : "px-4")}>
            <span className={cn("mt-2 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-primary")} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm", n.read ? "text-muted" : "font-medium text-ink")}>
                {n.read ? null : <span className="sr-only">לא נקרא: </span>}
                {n.title}
              </p>
              {n.body ? <p className="mt-0.5 text-sm text-muted">{n.body}</p> : null}
              <p className="mt-1 text-xs tabular-nums text-subtle">{formatDate(n.createdAt)}</p>
            </div>
          </div>
        );
        const rowClass =
          "block w-full text-start transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus";
        return (
          <li key={n.id}>
            {n.link ? (
              <Link
                href={n.link}
                onClick={() => {
                  markRead(n.id);
                  onNavigate?.();
                }}
                className={rowClass}
              >
                {inner}
              </Link>
            ) : (
              <button type="button" onClick={() => markRead(n.id)} className={rowClass}>
                {inner}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );

  if (compact) {
    return (
      <div>
        {list}
        {hasUnread ? (
          <div className="border-t border-line p-2">
            <Button variant="quiet" size="sm" onClick={markAll} className="w-full">
              סימון הכול כנקרא
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={markAll} disabled={!hasUnread}>
          סימון הכול כנקרא
        </Button>
      </div>
      <Panel className="p-0">{list}</Panel>
    </div>
  );
}
