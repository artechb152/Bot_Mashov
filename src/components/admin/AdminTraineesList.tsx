"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Dialog, Field, Input, Select, Panel, Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui";

type Trainee = { id: string; fullName: string; ownerId: string; status: "active" | "archived" };
type StaffOpt = { id: string; label: string };

export function AdminTraineesList({
  trainees,
  staff,
  ownerLabels,
}: {
  trainees: Trainee[];
  staff: StaffOpt[];
  ownerLabels: Record<string, string>;
}) {
  const [rows, setRows] = useState(trainees);
  const [transferFor, setTransferFor] = useState<Trainee | null>(null);
  const [toUserId, setToUserId] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submitTransfer() {
    if (!transferFor) return;
    setError(null);
    if (!toUserId) return setError("יש לבחור מפקד יעד.");
    if (!reason.trim()) return setError("יש להזין סיבה להעברה.");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/trainees/${transferFor.id}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toUserId, reason: reason.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ההעברה נכשלה.");
        return;
      }
      setRows((prev) => prev.map((t) => (t.id === transferFor.id ? { ...t, ownerId: toUserId } : t)));
      setTransferFor(null);
      setToUserId("");
      setReason("");
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return (
      <Panel>
        <EmptyState title="אין תיקי חניך" description="אין עדיין תיקי חניך בקורס זה." />
      </Panel>
    );
  }

  return (
    <>
      <Panel className="p-0">
        <Table>
          <THead>
            <TR>
              <TH>שם החניך</TH>
              <TH>מפקד מלווה</TH>
              <TH>סטטוס</TH>
              <TH><span className="sr-only">פעולות</span></TH>
            </TR>
          </THead>
          <TBody>
            {rows.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium">
                  <Link href={`/admin/trainees/${t.id}`} className="hover:underline">{t.fullName}</Link>
                </TD>
                <TD className="text-muted">{ownerLabels[t.ownerId] ?? "—"}</TD>
                <TD className="text-muted">{t.status === "archived" ? "בארכיון" : "פעיל"}</TD>
                <TD className="text-end">
                  <Button variant="ghost" size="sm" onClick={() => { setTransferFor(t); setError(null); }}>
                    העברת בעלות
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Panel>

      <Dialog open={transferFor !== null} onClose={() => setTransferFor(null)} title="העברת בעלות על תיק חניך">
        <div className="space-y-4">
          {error ? (
            <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">{error}</p>
          ) : null}
          <p className="text-sm text-muted">
            החניך <span className="font-medium text-ink">{transferFor?.fullName}</span> יועבר למפקד אחר באותו הקורס. הבעלות המקורית תישמר בהיסטוריה.
          </p>
          <Field label="מפקד יעד" htmlFor="transfer-to" required>
            <Select id="transfer-to" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
              <option value="">בחר/י מפקד</option>
              {staff.filter((s) => s.id !== transferFor?.ownerId).map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="סיבת ההעברה" htmlFor="transfer-reason" required>
            <Input id="transfer-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setTransferFor(null)} disabled={busy}>ביטול</Button>
            <Button onClick={submitTransfer} disabled={busy}>{busy ? "מעביר…" : "אישור העברה"}</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
