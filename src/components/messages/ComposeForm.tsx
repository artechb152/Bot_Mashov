"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, Input, Textarea, Panel } from "@/components/ui";

type RecipientCard = { id: string; displayName: string; username: string; role: string };
type GroupOption = { id: string; label: string };

export function ComposeForm({ draftId, initialRecipientId }: { draftId?: string; initialRecipientId?: string }) {
  const router = useRouter();
  const [users, setUsers] = useState<RecipientCard[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [userSearch, setUserSearch] = useState("");

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ count: number } | null>(null);

  useEffect(() => {
    fetch("/api/messages/recipients")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          const list = (d.users ?? []) as RecipientCard[];
          setUsers(list);
          setGroups(d.groups ?? []);
          // Preselect a recipient passed via ?to — but ONLY if it appears in the
          // server-authorized recipient list. Otherwise surface a clear error and
          // select nothing (never silently pick an unauthorized/invalid recipient).
          if (initialRecipientId) {
            if (list.some((u) => u.id === initialRecipientId)) {
              setSelectedUsers(new Set([initialRecipientId]));
            } else {
              setError("הנמען שנבחר אינו זמין או שאין לך הרשאה לשלוח אליו.");
            }
          }
        }
      })
      .catch(() => {});
    if (draftId) {
      fetch(`/api/messages/drafts/${draftId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.draft) {
            setSubject(d.draft.subject ?? "");
            setBody(d.draft.body ?? "");
          }
        })
        .catch(() => {});
    }
  }, [draftId, initialRecipientId]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => `${u.displayName} ${u.username}`.toLowerCase().includes(q));
  }, [users, userSearch]);

  function toggle(set: Set<string>, id: string, setter: (s: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  async function send(force: boolean) {
    setError(null);
    if (selectedUsers.size === 0 && selectedGroups.size === 0) {
      setError("יש לבחור לפחות נמען אחד.");
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.set("subject", subject);
      fd.set("body", body);
      fd.set("spec", JSON.stringify({ userIds: [...selectedUsers], groups: [...selectedGroups] }));
      if (force) fd.set("confirm", "true");
      for (const f of files) fd.append("files", f);

      const res = await fetch("/api/messages", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string; threadId?: string; needsConfirm?: boolean; count?: number };
      if (res.status === 409 && data.needsConfirm) {
        setConfirm({ count: data.count ?? 0 });
        return;
      }
      if (!res.ok || !data.threadId) {
        setError(data.error ?? "שליחת ההודעה נכשלה.");
        return;
      }
      router.push(`/messages/${data.threadId}`);
    } catch {
      setError("שליחת ההודעה נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setSending(false);
      setConfirm(null);
    }
  }

  async function saveDraft() {
    await fetch("/api/messages/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftId, subject, body }),
    }).catch(() => {});
    router.push("/messages/drafts");
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger">{error}</p>
      ) : null}

      <Panel className="space-y-4">
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">נמענים</p>
          {groups.length > 0 ? (
            <div className="mb-3 flex flex-wrap gap-2">
              {groups.map((g) => (
                <label key={g.id} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-sm text-ink">
                  <input type="checkbox" checked={selectedGroups.has(g.id)} onChange={() => toggle(selectedGroups, g.id, setSelectedGroups)} className="h-3.5 w-3.5" />
                  {g.label}
                </label>
              ))}
            </div>
          ) : null}
          <Input placeholder="חיפוש משתמשים…" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="mb-2 max-w-xs" />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-line">
            {filteredUsers.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">אין משתמשים זמינים.</p>
            ) : (
              <ul className="divide-y divide-line">
                {filteredUsers.map((u) => (
                  <li key={u.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-surface-2">
                      <input type="checkbox" checked={selectedUsers.has(u.id)} onChange={() => toggle(selectedUsers, u.id, setSelectedUsers)} className="h-4 w-4" />
                      <span className="text-ink">{u.displayName}</span>
                      <span className="text-xs text-subtle">{u.username}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Field label="נושא" htmlFor="subject">
          <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </Field>
        <Field label="תוכן" htmlFor="body">
          <Textarea id="body" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
        </Field>
        <Field label="קבצים מצורפים" htmlFor="files" hint="עד 5 קבצים, 5MB לכל קובץ.">
          <input
            id="files"
            type="file"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-sm text-muted file:me-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-1.5 file:text-sm file:text-ink"
          />
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={saveDraft} disabled={sending}>שמירת טיוטה</Button>
          <Button onClick={() => send(false)} disabled={sending}>{sending ? "שולח…" : "שליחה"}</Button>
        </div>
      </Panel>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title="אישור שליחה מרובה">
        <div className="space-y-4">
          <p className="text-sm text-ink">ההודעה תישלח ל־{confirm?.count} משתמשים. להמשיך?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(null)} disabled={sending}>ביטול</Button>
            <Button onClick={() => send(true)} disabled={sending}>{sending ? "שולח…" : "שליחה"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
