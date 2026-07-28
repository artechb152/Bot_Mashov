"use client";

import { useState } from "react";
import Link from "next/link";
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

export function NotificationsList({ initial, onNavigate }: { initial: Notif[]; onNavigate?: () => void }) {
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
    return (
      <Panel>
        <EmptyState title="אין התראות" description="כאן יופיעו עדכונים על הודעות, בקשות ושינויים." />
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={markAll} disabled={!hasUnread}>
          סימון הכל כנקרא
        </Button>
      </div>
      <Panel className="p-0">
        <ul className="divide-y divide-line">
          {items.map((n) => {
            const inner = (
              <div className="flex items-start gap-3 px-4 py-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-danger"}`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read ? "text-muted" : "font-medium text-ink"}`}>{n.title}</p>
                  {n.body ? <p className="mt-0.5 text-xs text-muted">{n.body}</p> : null}
                  <p className="mt-1 text-xs text-subtle tabular-nums">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? (
                  <Link
                    href={n.link}
                    onClick={() => {
                      markRead(n.id);
                      onNavigate?.();
                    }}
                    className="block transition-colors hover:bg-surface-2"
                  >
                    {inner}
                  </Link>
                ) : (
                  <button type="button" onClick={() => markRead(n.id)} className="block w-full text-start transition-colors hover:bg-surface-2">
                    {inner}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
