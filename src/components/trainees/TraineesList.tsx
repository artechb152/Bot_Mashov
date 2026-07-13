"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Search, Users } from "lucide-react";
import {
  buttonClasses,
  EmptyState,
  Input,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@/components/ui";
import type { TraineeDTO } from "@/lib/data/trainees";

export function TraineesList({ trainees }: { trainees: TraineeDTO[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim();

  const filtered = useMemo(
    () => (q ? trainees.filter((t) => t.fullName.includes(q)) : trainees),
    [trainees, q],
  );

  if (trainees.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="אין עדיין חניכים"
        description="הוסיפו את החניך הראשון כדי להתחיל בניהול החניכים."
        action={
          <Link href="/trainees/new" className={buttonClasses()}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            הוספת חניך
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search
            className="pointer-events-none absolute inset-y-0 end-3 my-auto h-4 w-4 text-subtle"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש לפי שם…"
            aria-label="חיפוש חניך לפי שם"
            className="pe-9"
          />
        </div>
        <Link href="/trainees/new" className={buttonClasses()}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          הוספת חניך
        </Link>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="לא נמצאו חניכים" description={`אין תוצאות עבור "${q}".`} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>שם</TH>
              <TH>צוות</TH>
              <TH>חוזקות</TH>
              <TH>חולשות</TH>
              <TH>
                <span className="sr-only">פעולות</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {filtered.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium">
                  <Link
                    href={`/trainees/${t.id}`}
                    className="hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {t.fullName}
                  </Link>
                </TD>
                <TD className="text-muted">{t.team || "—"}</TD>
                <TD className="text-muted tabular-nums">{t.strengths.length}</TD>
                <TD className="text-muted tabular-nums">{t.weaknesses.length}</TD>
                <TD className="text-end">
                  <Link
                    href={`/trainees/${t.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline"
                  >
                    פרופיל
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {filtered.length > 0 ? (
        <p className="text-xs text-muted">
          מוצגים {filtered.length} מתוך {trainees.length} חניכים
        </p>
      ) : null}
    </div>
  );
}
