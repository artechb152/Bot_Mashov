"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Paperclip, Archive, Trash2, Lock } from "lucide-react";
import { Button, Panel, Textarea } from "@/components/ui";

type Attachment = { id: string; filename: string; mimeType: string; size: number };
type Message = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  isSystem: boolean;
  mine: boolean;
  sentAt: string | null;
  attachments: Attachment[];
};
type TraineeRef = { id: string; name: string; accessible: boolean; href: string | null };
type Thread = {
  id: string;
  subject: string;
  threadType: string;
  participants: { id: string; name: string }[];
  messages: Message[];
  traineeRefs: TraineeRef[];
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "";
  }
}

export function ThreadView({ thread }: { thread: Thread }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Request-reply gating (§30): on a request thread, the requester may reply only
  // AFTER an authorized non-requester (reviewer) has responded. The seed submission
  // is authored by the requester (`mine`), so "a message that is not mine" means a
  // reviewer has engaged. For a reviewer, the requester's submission is already
  // "not mine", so they can respond immediately. Normal (non-request) threads are
  // never gated.
  const isRequestThread = thread.threadType === "request";
  const counterpartyPosted = thread.messages.some((m) => !m.mine);
  const canReply = !isRequestThread || counterpartyPosted;

  async function reply() {
    setError(null);
    if (!body.trim() && files.length === 0) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("body", body);
      for (const f of files) fd.append("files", f);
      const res = await fetch(`/api/messages/${thread.id}`, { method: "POST", body: fd });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "השליחה נכשלה.");
        return;
      }
      setBody("");
      setFiles([]);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  async function archive() {
    await fetch(`/api/messages/${thread.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived: true }),
    }).catch(() => {});
    router.push("/messages/inbox");
    router.refresh(); // invalidate the cached list so the archived thread is gone (§33)
  }

  async function remove() {
    await fetch(`/api/messages/${thread.id}/delete`, { method: "POST" }).catch(() => {});
    router.push("/messages/inbox");
    router.refresh(); // invalidate the cached list so the deleted thread is gone (§33)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{thread.subject || "(ללא נושא)"}</h2>
          <p className="mt-0.5 text-xs text-muted">{thread.participants.map((p) => p.name).join(", ")}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={archive}><Archive className="h-4 w-4" aria-hidden="true" /><span className="ms-1">ארכיון</span></Button>
          <Button variant="ghost" size="sm" onClick={remove}><Trash2 className="h-4 w-4" aria-hidden="true" /><span className="ms-1">מחיקה</span></Button>
        </div>
      </div>

      {thread.traineeRefs.length > 0 ? (
        <Panel className="space-y-1.5">
          <p className="text-xs font-medium text-muted">תיקי חניך מקושרים</p>
          {thread.traineeRefs.map((r) =>
            r.accessible && r.href ? (
              <Link key={r.id} href={r.href} className="block text-sm font-medium text-ink hover:underline">
                {r.name}
              </Link>
            ) : (
              <p key={r.id} className="flex items-center gap-1.5 text-sm text-muted">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                {r.name}
              </p>
            ),
          )}
        </Panel>
      ) : null}

      <div className="space-y-3">
        {thread.messages.map((m) => (
          <div
            key={m.id}
            className={
              m.isSystem
                ? "rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-sm text-muted"
                : `rounded-lg border px-4 py-3 ${m.mine ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink"}`
            }
          >
            {!m.isSystem ? (
              <div className="mb-1 flex items-center justify-between text-xs opacity-80">
                <span className="font-medium">{m.senderName}</span>
                <span className="tabular-nums">{formatDate(m.sentAt)}</span>
              </div>
            ) : null}
            <p className="whitespace-pre-wrap text-sm">{m.body}</p>
            {m.attachments.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {m.attachments.map((a) => (
                  <li key={a.id}>
                    <a
                      href={`/api/messages/attachments/${a.id}`}
                      className={`inline-flex items-center gap-1.5 text-xs underline ${m.mine ? "text-slate-200" : "text-ink"}`}
                    >
                      <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
                      {a.filename}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>

      {canReply ? (
        <Panel className="space-y-3">
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
          <Textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="כתוב תשובה…" />
          <div className="flex items-center justify-between gap-2">
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              className="block max-w-[60%] text-xs text-muted file:me-2 file:rounded file:border-0 file:bg-surface-2 file:px-2 file:py-1 file:text-xs file:text-ink"
            />
            <Button onClick={reply} disabled={sending}>{sending ? "שולח…" : "שליחת תשובה"}</Button>
          </div>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm text-muted">
            הבקשה ממתינה למענה של גורם מוסמך. לא ניתן להוסיף תגובה עד שתתקבל התייחסות.
          </p>
        </Panel>
      )}
    </div>
  );
}
