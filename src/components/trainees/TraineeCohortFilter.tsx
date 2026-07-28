"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui";

type OwnedCohort = { id: string; name: string; status: string };

/**
 * Compact cohort selector for the staff trainee list. Persists the choice in the
 * URL (?cohort=…), filtered to the cohorts the staff actually has records in.
 * Archived cohorts are labelled so the archive state is clear.
 */
export function TraineeCohortFilter({
  cohorts,
  selected,
}: {
  cohorts: OwnedCohort[];
  selected: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  if (cohorts.length === 0) return null;

  function onChange(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete("cohort");
    else next.set("cohort", value);
    router.push(`/trainees?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label htmlFor="cohort-filter" className="text-sm text-muted">
        מחזור
      </label>
      <Select
        id="cohort-filter"
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="w-auto min-w-56"
      >
        <option value="all">כל המחזורים</option>
        {cohorts.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.status === "archived" ? " (ארכיון)" : ""}
          </option>
        ))}
      </Select>
    </div>
  );
}
