"use client";

import { useState } from "react";
import { Button, Field, Input, Panel } from "@/components/ui";

export function ProfileSettingsForm({
  initialDisplayName,
  initialUsername,
}: {
  initialDisplayName: string;
  initialUsername: string;
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = displayName.trim() !== initialDisplayName || username.trim() !== initialUsername;

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: displayName.trim(), username: username.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "עדכון הפרופיל נכשל.");
        return;
      }
      setSaved(true);
    } catch {
      setError("עדכון הפרופיל נכשל. בדקו את החיבור ונסו שוב.");
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
          <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink">הפרטים נשמרו.</p>
        ) : null}

        <Field label="שם תצוגה" htmlFor="displayName" required>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" required />
        </Field>

        <Field label="שם משתמש" htmlFor="username" required hint="עד 21 תווים. שינוי שם המשתמש אינו משפיע על תיקי החניך או ההרשאות שלך.">
          <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving || !dirty}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
