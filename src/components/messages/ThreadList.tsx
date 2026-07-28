"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Trash2, ArchiveRestore } from "lucide-react";
import { Input, Panel, EmptyState } from "@/components/ui";

type Thread = {
  id: string;
  subject: string;
  threadType: string;
  lastMessageAt: string | null;
  unread: boolean;
  participantCount: number;
  snippet: string;
  mine: boolean;
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

export function ThreadList({ threads, folder }: { threads: Thread[]; folder: "inbox" | "sent" | "archive" }) {
  const router = useRouter();
  const [items, setItems] = useState(threads);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((t) => `${t.subject} ${t.snippet}`.toLowerCase().includes(q));
  }, [items, search]);

  async function archive(id: string, archived: boolean) {
    await fetch(`/api/messages/${id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    }).catch(() => {});
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  async function remove(id: string) {
    await fetch(`/api/messages/${id}/delete`, { method: "POST" }).catch(() => {});
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState title="אין הודעות" description="אין הודעות בתיקייה זו." />
      </Panel>
    );
  }

  return (
    <div className="space-y-3">
      <Input placeholder="חיפוש בהודעות…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
      <Panel className="p-0">
        <ul className="divide-y divide-line">
          {filtered.map((t) => (
            <li key={t.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-2">
              <button
                type="button"
                onClick={() => router.push(`/messages/${t.id}`)}
                className="min-w-0 flex-1 text-start"
              >
                <span className="flex items-center gap-2">
                  {t.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-danger" aria-hidden="true" /> : null}
                  <span className={`truncate text-sm ${t.unread ? "font-semibold text-ink" : "text-ink"}`}>
                    {t.subject || "(ללא נושא)"}
                  </span>
                  {t.threadType === "request" ? (
                    <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">בקשה</span>
                  ) : null}
                </span>
                {t.snippet ? <span className="mt-0.5 block truncate text-xs text-muted">{t.snippet}</span> : null}
                <span className="mt-1 block text-xs text-subtle tabular-nums">
                  {formatDate(t.lastMessageAt)} · {t.participantCount} משתתפים
                </span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                {folder === "archive" ? (
                  <button type="button" onClick={() => archive(t.id, false)} aria-label="החזרה מהארכיון" title="החזרה מהארכיון" className="grid h-8 w-8 place-items-center rounded-md text-subtle hover:bg-surface hover:text-ink">
                    <ArchiveRestore className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" onClick={() => archive(t.id, true)} aria-label="העברה לארכיון" title="העברה לארכיון" className="grid h-8 w-8 place-items-center rounded-md text-subtle hover:bg-surface hover:text-ink">
                    <Archive className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
                <button type="button" onClick={() => remove(t.id)} aria-label="מחיקה" title="מחיקה (עבורך בלבד)" className="grid h-8 w-8 place-items-center rounded-md text-subtle hover:bg-surface hover:text-danger">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
