"use client";

import { useState } from "react";
import { Button, Dialog } from "@/components/ui";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/domain/types";

/**
 * Promote/demote a single user. The dangerous transitions are guarded server-side
 * (`adminSetUserRole`): removing the last admin is refused (409), and demoting
 * yourself needs an explicit confirm — the server answers 409 + `needsConfirm`,
 * which opens the confirmation dialog here and re-sends with `confirm: true`.
 */
export function RoleControl({
  userId,
  initialRole,
  isSelf,
}: {
  userId: string;
  initialRole: UserRole;
  isSelf: boolean;
}) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const other: UserRole = role === "admin" ? "staff" : "admin";

  async function setRoleTo(next: UserRole, confirm = false) {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: next, confirm }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        user?: { role: UserRole };
        error?: string;
        needsConfirm?: boolean;
      };

      if (res.ok && data.user) {
        setRole(data.user.role);
        setConfirmOpen(false);
        // Refresh so the sidebar/label and any derived UI reflect the new role.
        window.location.reload();
        return;
      }

      // Self-demotion needs explicit confirmation → open the dialog.
      if (data.needsConfirm) {
        setConfirmOpen(true);
        return;
      }
      setError(data.error ?? "עדכון התפקיד נכשל.");
    } catch {
      setError("עדכון התפקיד נכשל. בדקו את החיבור ונסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">
          תפקיד נוכחי: <span className="font-medium text-ink">{USER_ROLE_LABELS[role]}</span>
        </span>
        <Button
          variant={other === "admin" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setRoleTo(other)}
          disabled={saving}
        >
          {saving
            ? "מעדכן…"
            : other === "admin"
              ? "הפיכה למנהל"
              : "הסרת הרשאת מנהל"}
        </Button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-surface px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      {isSelf ? (
        <p className="text-xs text-subtle">שים לב: זהו החשבון שאיתו אתה מחובר.</p>
      ) : null}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        ariaLabel="אישור הסרת הרשאת מנהל"
        className="max-w-sm"
      >
        <p className="text-sm text-ink">
          להסיר את הרשאת המנהל של עצמך? לאחר מכן לא תהיה לך גישה לאזור הניהול.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={saving}>
            ביטול
          </Button>
          <Button variant="danger" onClick={() => setRoleTo("staff", true)} disabled={saving}>
            {saving ? "מעדכן…" : "הסרת הרשאה"}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
