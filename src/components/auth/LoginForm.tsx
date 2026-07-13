"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import { safeNextPath } from "@/lib/auth/safe-next";

export function LoginForm({ next }: { next?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    // Set once we start a full-page navigation, so `finally` keeps the button
    // disabled through the unload (no flash, no double submit).
    let navigating = false;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ההתחברות נכשלה.");
        return;
      }
      // Success: full-page navigation so the new session cookie is applied and the
      // target renders logged-in immediately — no manual refresh. (A router.push +
      // router.refresh combo could race and leave the button stuck on "מתחבר…".)
      navigating = true;
      window.location.assign(safeNextPath(next));
    } catch {
      setError("ההתחברות נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      if (!navigating) setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-line bg-danger-surface px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <Field label="שם משתמש" htmlFor="username" required>
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </Field>

      <Field label="סיסמה" htmlFor="password" required>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "מתחבר…" : "התחברות"}
      </Button>
    </form>
  );
}
