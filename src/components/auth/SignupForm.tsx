"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { CourseChoice } from "@/components/course/CourseChoice";
import type { CourseType } from "@/lib/domain/types";

type CourseOpt = { code: CourseType; name: string; courseId: string };
type CohortOpt = { id: string; courseId: string; courseType: CourseType; name: string };
type TeamOpt = { id: string; cohortId: string; name: string };
type PositionOpt = { value: string; label: string };

export function SignupForm() {
  const [mode, setMode] = useState<"staff" | "admin">("staff");

  // Shared identity fields.
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Staff org selection.
  const [options, setOptions] = useState<{ courses: CourseOpt[]; cohorts: CohortOpt[]; teams: TeamOpt[] } | null>(null);
  const [courseType, setCourseType] = useState<CourseType | null>(null);
  const [cohortId, setCohortId] = useState("");
  const [teamId, setTeamId] = useState("");

  // Admin invite.
  const [inviteCode, setInviteCode] = useState("");
  const [inviteCtx, setInviteCtx] = useState<{ courseName: string; positions: PositionOpt[] } | null>(null);
  const [adminPosition, setAdminPosition] = useState("");
  const [checkingCode, setCheckingCode] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/signup-options")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d) setOptions(d);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const cohortsForCourse = useMemo(
    () => (options && courseType ? options.cohorts.filter((c) => c.courseType === courseType) : []),
    [options, courseType],
  );
  const teamsForCohort = useMemo(
    () => (options && cohortId ? options.teams.filter((t) => t.cohortId === cohortId) : []),
    [options, cohortId],
  );

  async function checkInvite() {
    setError(null);
    if (!inviteCode.trim()) {
      setError("יש להזין קוד הרשאה.");
      return;
    }
    setCheckingCode(true);
    try {
      const res = await fetch("/api/auth/invite/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: inviteCode.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        courseName?: string;
        allowedAdminPositions?: PositionOpt[];
      };
      if (!res.ok) {
        setInviteCtx(null);
        setError(data.error ?? "קוד ההרשאה אינו תקין");
        return;
      }
      const positions = data.allowedAdminPositions ?? [];
      setInviteCtx({ courseName: data.courseName ?? "", positions });
      if (positions.length === 1) setAdminPosition(positions[0].value);
    } catch {
      setError("בדיקת הקוד נכשלה. בדקו את החיבור ונסו שוב.");
    } finally {
      setCheckingCode(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== confirmPassword) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }

    let payload: Record<string, unknown>;
    if (mode === "staff") {
      if (!courseType) return setError("יש לבחור קורס.");
      if (!cohortId) return setError("יש לבחור מחזור.");
      if (!teamId) return setError("יש לבחור צוות.");
      payload = { displayName: displayName.trim(), username: username.trim(), password, confirmPassword, courseType, cohortId, teamId };
    } else {
      if (!inviteCtx) return setError("יש לבדוק את קוד ההרשאה תחילה.");
      if (!adminPosition) return setError("יש לבחור תפקיד ניהולי.");
      payload = { displayName: displayName.trim(), username: username.trim(), password, confirmPassword, inviteCode: inviteCode.trim(), adminPosition };
    }

    setSubmitting(true);
    let navigating = false;
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "ההרשמה נכשלה.");
        return;
      }
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
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Field label="שם תצוגה" htmlFor="displayName" required hint="השם שיוצג במערכת (למשל: דנה כהן).">
        <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" required />
      </Field>

      <Field label="שם משתמש" htmlFor="username" required hint="עד 21 תווים. אפשר עברית, אנגלית, ספרות וסימנים פשוטים.">
        <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
      </Field>

      <Field label="סיסמה" htmlFor="password" required hint="לפחות 6 תווים.">
        <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
      </Field>

      <Field label="אימות סיסמה" htmlFor="confirmPassword" required>
        <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" required />
      </Field>

      {mode === "staff" ? (
        <>
          <CourseChoice
            value={courseType}
            onChange={(c) => {
              setCourseType(c);
              setCohortId("");
              setTeamId("");
            }}
            disabled={submitting}
          />
          <Field label="מחזור" htmlFor="cohort" required>
            <Select
              id="cohort"
              value={cohortId}
              onChange={(e) => {
                setCohortId(e.target.value);
                setTeamId("");
              }}
              disabled={submitting || !courseType || cohortsForCourse.length === 0}
              required
            >
              <option value="">{courseType ? "בחר/י מחזור" : "בחר/י קורס תחילה"}</option>
              {cohortsForCourse.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="צוות" htmlFor="team" required>
            <Select
              id="team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={submitting || !cohortId || teamsForCohort.length === 0}
              required
            >
              <option value="">{cohortId ? "בחר/י צוות" : "בחר/י מחזור תחילה"}</option>
              {teamsForCohort.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        </>
      ) : (
        <div className="space-y-4 rounded-lg border border-line bg-surface-2 p-4">
          <Field label="קוד הרשאה זמני" htmlFor="inviteCode" required>
            <div className="flex items-center gap-2">
              <Input
                id="inviteCode"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value);
                  setInviteCtx(null);
                }}
                placeholder="ADM-XXXX-XXXX-XXXX"
                autoComplete="off"
                className="flex-1"
              />
              <Button type="button" variant="secondary" size="sm" onClick={checkInvite} disabled={checkingCode || submitting}>
                {checkingCode ? "בודק…" : "בדיקת קוד"}
              </Button>
            </div>
          </Field>

          {inviteCtx ? (
            <>
              <Field label="קורס" htmlFor="admin-course">
                <Input id="admin-course" value={inviteCtx.courseName} disabled readOnly />
              </Field>
              <Field label="תפקיד ניהולי" htmlFor="adminPosition" required>
                <Select
                  id="adminPosition"
                  value={adminPosition}
                  onChange={(e) => setAdminPosition(e.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="">בחר/י תפקיד</option>
                  {inviteCtx.positions.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </>
          ) : null}
        </div>
      )}

      <Button type="submit" disabled={submitting || (mode === "admin" && !inviteCtx)} className="w-full">
        {submitting ? "נרשם…" : "הרשמה"}
      </Button>

      <div className="pt-1 text-center">
        {mode === "staff" ? (
          <button
            type="button"
            onClick={() => {
              setMode("admin");
              setError(null);
            }}
            disabled={submitting}
            className="text-xs font-medium text-muted transition-colors hover:text-ink focus-visible:underline focus-visible:outline-none"
          >
            יש לי קוד הרשאת מנהל
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMode("staff");
              setError(null);
              setInviteCtx(null);
            }}
            disabled={submitting}
            className="text-xs font-medium text-muted transition-colors hover:text-ink focus-visible:underline focus-visible:outline-none"
          >
            חזרה להרשמת סגל
          </button>
        )}
      </div>
    </form>
  );
}
