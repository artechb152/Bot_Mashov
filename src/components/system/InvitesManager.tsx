"use client";

import { useState } from "react";
import { Copy, KeyRound, Check } from "lucide-react";
import { Button, Dialog, Field, Panel, Select, Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui";
import { ADMIN_POSITION_LABELS, ADMIN_POSITIONS, type AdminPosition } from "@/lib/domain/types";

type InviteDTO = {
  id: string;
  courseId: string;
  courseName: string;
  allowedAdminPositions: AdminPosition[];
  status: "active" | "used" | "revoked" | "expired";
  expiresAt: string | null;
  createdAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
};

const STATUS_LABELS: Record<InviteDTO["status"], string> = {
  active: "פעיל",
  used: "נוצל",
  revoked: "בוטל",
  expired: "פג תוקף",
};

const EXPIRY_OPTIONS = [
  { hours: 1, label: "שעה" },
  { hours: 24, label: "24 שעות" },
  { hours: 72, label: "72 שעות" },
  { hours: 168, label: "7 ימים" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export function InvitesManager({
  initialInvites,
  courses,
}: {
  initialInvites: InviteDTO[];
  courses: { id: string; name: string }[];
}) {
  const [invites, setInvites] = useState<InviteDTO[]>(initialInvites);
  const [createOpen, setCreateOpen] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [positions, setPositions] = useState<Set<AdminPosition>>(new Set(ADMIN_POSITIONS));
  const [expiryHours, setExpiryHours] = useState(24);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function togglePosition(p: AdminPosition) {
    setPositions((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function create() {
    setError(null);
    if (!courseId) return setError("יש לבחור קורס.");
    if (positions.size === 0) return setError("יש לבחור לפחות תפקיד אחד.");
    setCreating(true);
    try {
      const res = await fetch("/api/system/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          allowedAdminPositions: Array.from(positions),
          expiresInHours: expiryHours,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; invite?: InviteDTO; code?: string };
      if (!res.ok || !data.invite || !data.code) {
        setError(data.error ?? "יצירת הקוד נכשלה.");
        return;
      }
      setInvites((prev) => [data.invite as InviteDTO, ...prev]);
      setCreateOpen(false);
      setCreatedCode(data.code);
    } catch {
      setError("יצירת הקוד נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/system/invites/${id}/revoke`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { invite?: InviteDTO };
    if (res.ok && data.invite) {
      setInvites((prev) => prev.map((i) => (i.id === id ? (data.invite as InviteDTO) : i)));
    }
  }

  async function copyCode() {
    if (!createdCode) return;
    try {
      await navigator.clipboard.writeText(createdCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — user can select manually */
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>יצירת קוד הרשאה</Button>
      </div>

      <Panel className="p-0">
        {invites.length === 0 ? (
          <EmptyState title="אין קודי הרשאה" description="צור קוד הרשאת מנהל חד־פעמי לקורס." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>קורס</TH>
                <TH>תפקידים מותרים</TH>
                <TH>סטטוס</TH>
                <TH>תפוגה</TH>
                <TH>נוצר</TH>
                <TH>פעולה</TH>
              </TR>
            </THead>
            <TBody>
              {invites.map((inv) => (
                <TR key={inv.id}>
                  <TD>{inv.courseName}</TD>
                  <TD>{inv.allowedAdminPositions.map((p) => ADMIN_POSITION_LABELS[p]).join(", ") || "—"}</TD>
                  <TD>{STATUS_LABELS[inv.status]}</TD>
                  <TD className="tabular-nums">{formatDate(inv.expiresAt)}</TD>
                  <TD className="tabular-nums">{formatDate(inv.createdAt)}</TD>
                  <TD>
                    {inv.status === "active" ? (
                      <Button variant="ghost" size="sm" onClick={() => revoke(inv.id)}>
                        ביטול
                      </Button>
                    ) : (
                      <span className="text-subtle">—</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>

      {/* Create dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="יצירת קוד הרשאת מנהל">
        <div className="space-y-4">
          {error ? (
            <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Field label="קורס" htmlFor="invite-course" required>
            <Select id="invite-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">תפקידים מותרים</legend>
            <div className="flex flex-wrap gap-3">
              {ADMIN_POSITIONS.map((p) => (
                <label key={p} className="inline-flex items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    checked={positions.has(p)}
                    onChange={() => togglePosition(p)}
                    className="h-4 w-4 rounded border-line-strong text-primary focus-visible:ring-2 focus-visible:ring-focus"
                  />
                  {ADMIN_POSITION_LABELS[p]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field label="תוקף" htmlFor="invite-expiry" required>
            <Select id="invite-expiry" value={String(expiryHours)} onChange={(e) => setExpiryHours(Number(e.target.value))}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.hours} value={o.hours}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>
              ביטול
            </Button>
            <Button onClick={create} disabled={creating}>
              {creating ? "יוצר…" : "יצירה"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* One-time code reveal */}
      <Dialog open={createdCode !== null} onClose={() => setCreatedCode(null)} title="קוד ההרשאה נוצר">
        <div className="space-y-4">
          <p className="rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger">
            הקוד יוצג פעם אחת בלבד. לאחר סגירת החלון לא ניתן יהיה לצפות בו שוב.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface-2 px-3 py-3">
            <KeyRound className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <code className="flex-1 select-all text-base font-semibold tracking-wide text-ink" dir="ltr">
              {createdCode}
            </code>
            <Button variant="secondary" size="sm" onClick={copyCode}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              <span className="ms-1">{copied ? "הועתק" : "העתקה"}</span>
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setCreatedCode(null)}>הבנתי, סגור</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
