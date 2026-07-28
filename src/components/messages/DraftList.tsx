"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Panel, EmptyState } from "@/components/ui";

type Draft = { id: string; subject: string; body: string; updatedAt: string | null };

export function DraftList({ drafts }: { drafts: Draft[] }) {
  const router = useRouter();
  const [items, setItems] = useState(drafts);

  async function remove(id: string) {
    await fetch(`/api/messages/drafts/${id}`, { method: "DELETE" }).catch(() => {});
    setItems((prev) => prev.filter((d) => d.id !== id));
  }

  if (items.length === 0) {
    return (
      <Panel>
        <EmptyState title="אין טיוטות" description="טיוטות שתשמור יופיעו כאן." />
      </Panel>
    );
  }

  return (
    <Panel className="p-0">
      <ul className="divide-y divide-line">
        {items.map((d) => (
          <li key={d.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
            <button type="button" onClick={() => router.push(`/messages/compose?draft=${d.id}`)} className="min-w-0 flex-1 text-start">
              <span className="block truncate text-sm font-medium text-ink">{d.subject || "(ללא נושא)"}</span>
              <span className="block truncate text-xs text-muted">{d.body}</span>
            </button>
            <button type="button" onClick={() => remove(d.id)} aria-label="מחיקת טיוטה" className="grid h-8 w-8 place-items-center rounded-md text-subtle hover:bg-surface hover:text-danger">
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
