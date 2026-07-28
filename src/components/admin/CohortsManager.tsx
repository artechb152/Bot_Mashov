"use client";

import { useState } from "react";
import { Archive, RotateCcw, Plus, ChevronDown } from "lucide-react";
import { Button, Dialog, Field, Input, Select, Panel, EmptyState } from "@/components/ui";
import { COHORT_STATUS_LABELS } from "@/lib/domain/types";

type Cohort = {
  id: string;
  courseId: string;
  name: string;
  code: string | null;
  status: "planned" | "active" | "archived";
  isLocked: boolean;
  isLegacyDefault: boolean;
};
type Team = { id: string; cohortId: string; name: string; isActive: boolean };
type Course = { id: string; name: string };

export function CohortsManager({
  initialCohorts,
  initialTeams,
  courses,
  requireCourseSelect,
}: {
  initialCohorts: Cohort[];
  initialTeams: Team[];
  courses: Course[];
  requireCourseSelect: boolean;
}) {
  const [cohorts, setCohorts] = useState(initialCohorts);
  const [teams, setTeams] = useState(initialTeams);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [addCohortOpen, setAddCohortOpen] = useState(false);
  const [newCohortName, setNewCohortName] = useState("");
  const [newCohortCourse, setNewCohortCourse] = useState(courses[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  const [addTeamFor, setAddTeamFor] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");

  // Course identity (§6): show the course label next to a cohort when more than one
  // course is visible (a super-admin), so identically-named cohorts are differentiated.
  const courseName = new Map(courses.map((c) => [c.id, c.name]));
  const showCourse = courses.length > 1;

  async function patchCohort(id: string, patch: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/cohorts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = (await res.json().catch(() => ({}))) as { cohort?: Cohort; error?: string };
    if (res.ok && data.cohort) {
      setCohorts((prev) => prev.map((c) => (c.id === id ? (data.cohort as Cohort) : c)));
    } else {
      setError(data.error ?? "העדכון נכשל.");
    }
  }

  async function createCohort() {
    setError(null);
    if (!newCohortName.trim()) return setError("יש להזין שם מחזור.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/cohorts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCohortName.trim(),
          ...(requireCourseSelect ? { courseId: newCohortCourse } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { cohort?: Cohort; error?: string };
      if (res.ok && data.cohort) {
        setCohorts((prev) => [data.cohort as Cohort, ...prev]);
        setAddCohortOpen(false);
        setNewCohortName("");
      } else {
        setError(data.error ?? "יצירת המחזור נכשלה.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function createTeam(cohortId: string) {
    setError(null);
    if (!newTeamName.trim()) return setError("יש להזין שם צוות.");
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cohortId, name: newTeamName.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { team?: Team; error?: string };
    if (res.ok && data.team) {
      setTeams((prev) => [...prev, data.team as Team]);
      setNewTeamName("");
      setAddTeamFor(null);
    } else {
      setError(data.error ?? "יצירת הצוות נכשלה.");
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-surface px-4 py-2.5 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button onClick={() => setAddCohortOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span className="ms-1">יצירת מחזור</span>
        </Button>
      </div>

      {cohorts.length === 0 ? (
        <Panel>
          <EmptyState title="אין מחזורים" description="צור מחזור ראשון לקורס." />
        </Panel>
      ) : (
        <div className="space-y-3">
          {cohorts.map((c) => {
            const cohortTeams = teams.filter((t) => t.cohortId === c.id);
            const open = expanded === c.id;
            return (
              <Panel key={c.id} className="p-0">
                <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : c.id)}
                    className="flex items-center gap-2 text-sm font-medium text-ink hover:underline"
                  >
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
                    {showCourse && courseName.get(c.courseId) ? `${c.name} — ${courseName.get(c.courseId)}` : c.name}
                  </button>
                  <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
                    {COHORT_STATUS_LABELS[c.status]}
                  </span>
                  <span className="text-xs text-subtle">{cohortTeams.length} צוותים</span>

                  <div className="ms-auto flex items-center gap-1">
                    {c.status === "archived" ? (
                      <Button variant="ghost" size="sm" onClick={() => patchCohort(c.id, { status: "active" })}>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        <span className="ms-1">החזרה לפעיל</span>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => patchCohort(c.id, { status: "archived" })}>
                        <Archive className="h-4 w-4" aria-hidden="true" />
                        <span className="ms-1">ארכיון</span>
                      </Button>
                    )}
                  </div>
                </div>

                {open ? (
                  <div className="border-t border-line px-4 py-3">
                    <ul className="space-y-1.5">
                      {cohortTeams.map((t) => (
                        <li key={t.id} className="flex items-center gap-2 text-sm text-ink">
                          <span className="h-1.5 w-1.5 rounded-full bg-subtle" aria-hidden="true" />
                          {t.name}
                          {!t.isActive ? <span className="text-xs text-subtle">(לא פעיל)</span> : null}
                        </li>
                      ))}
                      {cohortTeams.length === 0 ? <li className="text-sm text-muted">אין צוותים במחזור זה.</li> : null}
                    </ul>
                    {addTeamFor === c.id ? (
                      <div className="mt-3 flex items-center gap-2">
                        <Input value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} placeholder="שם הצוות" className="max-w-xs" />
                        <Button size="sm" onClick={() => createTeam(c.id)}>הוספה</Button>
                        <Button variant="ghost" size="sm" onClick={() => { setAddTeamFor(null); setNewTeamName(""); }}>ביטול</Button>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAddTeamFor(c.id)}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span className="ms-1">הוספת צוות</span>
                      </Button>
                    )}
                  </div>
                ) : null}
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog open={addCohortOpen} onClose={() => setAddCohortOpen(false)} title="יצירת מחזור">
        <div className="space-y-4">
          {requireCourseSelect ? (
            <Field label="קורס" htmlFor="new-cohort-course" required>
              <Select id="new-cohort-course" value={newCohortCourse} onChange={(e) => setNewCohortCourse(e.target.value)}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="שם המחזור" htmlFor="new-cohort-name" required>
            <Input id="new-cohort-name" value={newCohortName} onChange={(e) => setNewCohortName(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAddCohortOpen(false)} disabled={busy}>ביטול</Button>
            <Button onClick={createCohort} disabled={busy}>{busy ? "יוצר…" : "יצירה"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
