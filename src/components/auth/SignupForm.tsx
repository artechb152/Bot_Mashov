"use client";

import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";

export function SignupForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }
    setSubmitting(true);
    // Set once we start a full-page navigation, so `finally` keeps the button
    // disabled through the unload (no flash, no double submit).
    let navigating = false;
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password, confirmPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ההרשמה נכשלה.");
        return;
      }
      // Success: full-page navigation so the new session cookie is applied and the
      // app renders logged-in immediately — no manual refresh. (A router.push +
      // router.refresh combo could race and leave the button stuck on "נרשם…".)
      navigating = true;
      window.location.assign("/");
    } catch {
      setError("ההרשמה נכשלה. בדקו את החיבור ונסו שוב.");
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

      <Field
        label="שם משתמש"
        htmlFor="username"
        required
        hint="עד 21 תווים. אפשר עברית, אנגלית, ספרות וסימנים פשוטים."
      >
        <Input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />
      </Field>

      <Field label="סיסמה" htmlFor="password" required hint="לפחות 6 תווים.">
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </Field>

      <Field label="אימות סיסמה" htmlFor="confirmPassword" required>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "נרשם…" : "הרשמה"}
      </Button>
    </form>
  );
}
