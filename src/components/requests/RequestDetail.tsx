"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Field, Panel, Textarea } from "@/components/ui";
import { ACCESS_REQUEST_STATUS_LABELS, type AccessRequestStatus } from "@/lib/domain/types";

type Req = {
  id: string;
  requestTypeLabel: string;
  requesterName: string;
  status: AccessRequestStatus;
  reason: string;
  reviewNote: string | null;
  targetSummary: string;
  threadId: string | null;
};

export function RequestDetail({ request, canReview, canCancel }: { request: Req; canReview: boolean; canCancel: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function act(path: string, body?: Record<string, unknown>) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/requests/${request.id}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "הפעולה נכשלה.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger">{error}</p> : null}

      <Panel className="space-y-2">
        <h2 className="text-lg font-semibold text-ink">{request.requestTypeLabel}</h2>
        <p className="text-sm text-muted">מבקש: {request.requesterName}</p>
        {request.targetSummary ? <p className="text-sm text-muted">יעד: {request.targetSummary}</p> : null}
        <p className="text-sm text-muted">סטטוס: {ACCESS_REQUEST_STATUS_LABELS[request.status]}</p>
        <div className="pt-1">
          <p className="text-xs font-medium text-muted">סיבה</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{request.reason}</p>
        </div>
        {request.reviewNote ? (
          <div className="pt-1">
            <p className="text-xs font-medium text-muted">הערת מאשר</p>
            <p className="whitespace-pre-wrap text-sm text-ink">{request.reviewNote}</p>
          </div>
        ) : null}
        {request.threadId ? (
          <Link href={`/messages/${request.threadId}`} className="inline-block pt-1 text-sm text-ink hover:underline">
            שיחת הבקשה →
          </Link>
        ) : null}
      </Panel>

      {canReview && request.status === "pending" ? (
        <Panel className="space-y-3">
          <Field label="הערת מאשר (חובה)" htmlFor="review-note" required>
            <Textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="danger" onClick={() => act("reject", { note })} disabled={busy}>דחייה</Button>
            <Button onClick={() => act("approve", { note })} disabled={busy}>אישור</Button>
          </div>
        </Panel>
      ) : null}

      {canCancel && request.status === "pending" ? (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => act("cancel")} disabled={busy}>ביטול הבקשה</Button>
        </div>
      ) : null}
    </div>
  );
}
