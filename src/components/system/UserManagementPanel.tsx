"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, ShieldAlert } from "lucide-react";
import { Button, Dialog, Field, Panel, Select } from "@/components/ui";
import {
  COURSE_LABELS,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  ADMIN_POSITION_LABELS,
  type UserRole,
  type UserStatus,
  type AdminPosition,
  type CourseType,
  type DirectoryVisibility,
} from "@/lib/domain/types";

type UserView = {
  id: string;
  displayName: string;
  username: string;
  role: UserRole;
  isRootSuperAdmin: boolean;
  status: UserStatus;
  adminPosition: AdminPosition | null;
  directoryVisibility: DirectoryVisibility;
  courseType: CourseType | null;
  traineeCount: number;
};

const EFFECT_NOTICE = "השינוי נשמר. ההרשאה החדשה תיכנס לתוקף לאחר שהמשתמש יתחבר מחדש.";

export function UserManagementPanel({ user, viewerIsRoot }: { user: UserView; viewerIsRoot: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(user.status);
  const [visibility, setVisibility] = useState(user.directoryVisibility);
  const [role, setRole] = useState<UserRole>(user.role);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [roleDialog, setRoleDialog] = useState(false);
  const [pendingRole, setPendingRole] = useState<UserRole>(user.role);

  const protectedRoot = user.isRootSuperAdmin;

  async function call(url: string, body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "הפעולה נכשלה.");
        return false;
      }
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: UserStatus) {
    const ok = await call(`/api/system/users/${user.id}/status`, { status: next });
    if (ok) {
      setStatus(next);
      setNotice("הסטטוס עודכן.");
      router.refresh();
    }
  }

  async function changeVisibility(next: DirectoryVisibility) {
    const ok = await call(`/api/system/users/${user.id}/visibility`, { visibility: next });
    if (ok) {
      setVisibility(next);
      setNotice("הנראות עודכנה.");
      router.refresh();
    }
  }

  async function confirmRoleChange() {
    const ok = await call(`/api/admin/users/${user.id}/role`, { role: pendingRole, confirm: true });
    if (ok) {
      setRole(pendingRole);
      setRoleDialog(false);
      setNotice(EFFECT_NOTICE);
      router.refresh();
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger">{error}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-sm text-ink">{notice}</p>
      ) : null}

      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
              {user.displayName || user.username}
              {protectedRoot ? <Crown className="h-4 w-4 text-amber-500" aria-label="מנהל־על ראשי" /> : null}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {user.username} · {USER_ROLE_LABELS[role]}
              {user.adminPosition ? ` · ${ADMIN_POSITION_LABELS[user.adminPosition]}` : ""}
              {user.courseType ? ` · ${COURSE_LABELS[user.courseType]}` : ""}
            </p>
          </div>
          <span className="rounded-md bg-surface-2 px-2.5 py-1 text-xs text-muted">{USER_STATUS_LABELS[status]}</span>
        </div>
      </Panel>

      {protectedRoot ? (
        <Panel>
          <p className="flex items-center gap-2 text-sm text-muted">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            חשבון מנהל־על ראשי מוגן — לא ניתן לשנות תפקיד, סטטוס או נראות דרך המערכת.
          </p>
        </Panel>
      ) : (
        <>
          {/* Account status */}
          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-ink">סטטוס חשבון</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant={status === "active" ? "primary" : "secondary"} size="sm" disabled={busy || status === "active"} onClick={() => changeStatus("active")}>
                הפעלה
              </Button>
              <Button variant={status === "suspended" ? "primary" : "secondary"} size="sm" disabled={busy || status === "suspended"} onClick={() => changeStatus("suspended")}>
                השהיה
              </Button>
              <Button variant="danger" size="sm" disabled={busy || status === "disabled"} onClick={() => changeStatus("disabled")}>
                השבתה
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted">השהיה או השבתה חוסמות התחברות אך שומרות את כל הרשומות.</p>
          </Panel>

          {/* Directory visibility */}
          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-ink">נראות בספר המשתמשים</h3>
            <div className="flex gap-2">
              <Button variant={visibility === "visible" ? "primary" : "secondary"} size="sm" disabled={busy || visibility === "visible"} onClick={() => changeVisibility("visible")}>
                גלוי
              </Button>
              <Button variant={visibility === "hidden" ? "primary" : "secondary"} size="sm" disabled={busy || visibility === "hidden"} onClick={() => changeVisibility("hidden")}>
                מוסתר
              </Button>
            </div>
          </Panel>

          {/* Role management — ROOT ONLY */}
          <Panel>
            <h3 className="mb-3 text-sm font-semibold text-ink">ניהול תפקיד</h3>
            {viewerIsRoot ? (
              <div className="flex flex-wrap items-end gap-3">
                <Field label="תפקיד" htmlFor="role-select">
                  <Select
                    id="role-select"
                    value={pendingRole}
                    onChange={(e) => setPendingRole(e.target.value as UserRole)}
                    className="w-auto min-w-40"
                  >
                    <option value="staff">{USER_ROLE_LABELS.staff}</option>
                    <option value="admin">{USER_ROLE_LABELS.admin}</option>
                    <option value="super_admin">{USER_ROLE_LABELS.super_admin}</option>
                  </Select>
                </Field>
                <Button size="sm" disabled={busy || pendingRole === role} onClick={() => setRoleDialog(true)}>
                  שינוי תפקיד
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted">רק מנהל־על ראשי יכול לשנות תפקידי משתמשים.</p>
            )}
          </Panel>
        </>
      )}

      <Dialog open={roleDialog} onClose={() => setRoleDialog(false)} title="אישור שינוי תפקיד">
        <div className="space-y-4">
          <p className="text-sm text-ink">
            לשנות את התפקיד של <span className="font-medium">{user.displayName || user.username}</span> ל־
            <span className="font-medium">{USER_ROLE_LABELS[pendingRole]}</span>?
          </p>
          <p className="text-sm text-muted">{EFFECT_NOTICE}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRoleDialog(false)} disabled={busy}>ביטול</Button>
            <Button onClick={confirmRoleChange} disabled={busy}>{busy ? "מעדכן…" : "אישור"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
