"use client";

import { useState } from "react";
import { Button, Field, Input, Panel } from "@/components/ui";

export function SecuritySettingsForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    if (newPassword !== confirmPassword) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/security", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "שינוי הסיסמה נכשל.");
        return;
      }
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("שינוי הסיסמה נכשל. בדקו את החיבור ונסו שוב.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel>
      <form onSubmit={save} className="space-y-4" noValidate>
        {error ? (
          <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {saved ? (
          <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink">הסיסמה עודכנה.</p>
        ) : null}

        <Field label="הסיסמה הנוכחית" htmlFor="currentPassword" required>
          <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" required />
        </Field>

        <Field label="סיסמה חדשה" htmlFor="newPassword" required hint="לפחות 6 תווים.">
          <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" required />
        </Field>

        <Field label="אימות סיסמה חדשה" htmlFor="confirmPassword" required>
          <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "שומר…" : "עדכון סיסמה"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
