"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, Panel } from "@/components/ui";
import { ACCESS_REQUEST_TYPES, ACCESS_REQUEST_TYPE_LABELS, ADMIN_POSITIONS, ADMIN_POSITION_LABELS, type AccessRequestType } from "@/lib/domain/types";

type Course = { code: string; name: string; courseId: string };
type Cohort = { id: string; courseId: string; courseType: string; name: string };
type Team = { id: string; cohortId: string; name: string };

export function NewRequestForm() {
  const router = useRouter();
  const [requestType, setRequestType] = useState<AccessRequestType>("trainee_view");
  const [reason, setReason] = useState("");
  const [targetTraineeId, setTargetTraineeId] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [targetCohortId, setTargetCohortId] = useState("");
  const [targetCourseId, setTargetCourseId] = useState("");
  const [adminPosition, setAdminPosition] = useState<string>(ADMIN_POSITIONS[1]);

  const [opts, setOpts] = useState<{ courses: Course[]; cohorts: Cohort[]; teams: Team[] }>({ courses: [], cohorts: [], teams: [] });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/signup-options").then((r) => (r.ok ? r.json() : null)).then((d) => d && setOpts(d)).catch(() => {});
  }, []);

  async function submit() {
    setError(null);
    if (!reason.trim()) return setError("יש להזין סיבה לבקשה.");
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { requestType, reason: reason.trim() };
      if (requestType === "trainee_view" || requestType === "trainee_edit") payload.targetTraineeId = targetTraineeId.trim();
      if (requestType === "team_change") payload.targetTeamId = targetTeamId;
      if (requestType === "cohort_change") payload.targetCohortId = targetCohortId;
      if (requestType === "course_change") payload.targetCourseId = targetCourseId;
      if (requestType === "admin_role_request") payload.payload = { adminPosition };

      const res = await fetch("/api/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? "הגשת הבקשה נכשלה.");
        return;
      }
      router.push(`/requests/${data.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="space-y-4">
      {error ? <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger">{error}</p> : null}

      <Field label="סוג הבקשה" htmlFor="req-type" required>
        <Select id="req-type" value={requestType} onChange={(e) => setRequestType(e.target.value as AccessRequestType)}>
          {ACCESS_REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>{ACCESS_REQUEST_TYPE_LABELS[t]}</option>
          ))}
        </Select>
      </Field>

      {(requestType === "trainee_view" || requestType === "trainee_edit") ? (
        <Field label="מזהה תיק חניך" htmlFor="req-trainee" required hint="ניתן לקבל את המזהה מקישור בהודעה.">
          <Input id="req-trainee" value={targetTraineeId} onChange={(e) => setTargetTraineeId(e.target.value)} />
        </Field>
      ) : null}

      {requestType === "team_change" ? (
        <Field label="צוות יעד" htmlFor="req-team" required>
          <Select id="req-team" value={targetTeamId} onChange={(e) => setTargetTeamId(e.target.value)}>
            <option value="">בחר/י צוות</option>
            {opts.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
      ) : null}

      {requestType === "cohort_change" ? (
        <Field label="מחזור יעד" htmlFor="req-cohort" required>
          <Select id="req-cohort" value={targetCohortId} onChange={(e) => setTargetCohortId(e.target.value)}>
            <option value="">בחר/י מחזור</option>
            {opts.cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </Field>
      ) : null}

      {requestType === "course_change" ? (
        <Field label="קורס יעד" htmlFor="req-course" required>
          <Select id="req-course" value={targetCourseId} onChange={(e) => setTargetCourseId(e.target.value)}>
            <option value="">בחר/י קורס</option>
            {opts.courses.map((c) => <option key={c.courseId} value={c.courseId}>{c.name}</option>)}
          </Select>
        </Field>
      ) : null}

      {requestType === "admin_role_request" ? (
        <Field label="תפקיד מבוקש" htmlFor="req-position" required>
          <Select id="req-position" value={adminPosition} onChange={(e) => setAdminPosition(e.target.value)}>
            {ADMIN_POSITIONS.map((p) => <option key={p} value={p}>{ADMIN_POSITION_LABELS[p]}</option>)}
          </Select>
        </Field>
      ) : null}

      <Field label="סיבה" htmlFor="req-reason" required>
        <Textarea id="req-reason" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={busy}>{busy ? "שולח…" : "הגשת בקשה"}</Button>
      </div>
    </Panel>
  );
}
