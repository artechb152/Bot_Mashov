"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Search, Users } from "lucide-react";
import { EmptyState, Input, Table, TBody, TD, TH, THead, TR } from "@/components/ui";
import { COURSE_LABELS, USER_ROLE_LABELS } from "@/lib/domain/types";
import type { AdminUserDTO } from "@/lib/data/admin";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function AdminUsersList({ users }: { users: AdminUserDTO[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      q
        ? users.filter(
            (u) =>
              u.username.toLowerCase().includes(q) || u.fullName.toLowerCase().includes(q),
          )
        : users,
    [users, q],
  );

  if (users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="אין עדיין משתמשים"
        description="משתמשים חדשים ייווצרו דרך מסך ההרשמה."
      />
    );
  }

  return (
    <div className="space-y-4">
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
          aria-label="חיפוש משתמש לפי שם"
          className="pe-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="לא נמצאו משתמשים" description={`אין תוצאות עבור "${query.trim()}".`} />
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>שם משתמש</TH>
              <TH className="hidden sm:table-cell">קורס</TH>
              <TH className="hidden sm:table-cell">תפקיד</TH>
              <TH>חניכים</TH>
              <TH className="hidden md:table-cell">נוצר</TH>
              <TH className="hidden sm:table-cell">
                <span className="sr-only">פעולות</span>
              </TH>
            </tr>
          </THead>
          <TBody>
            {filtered.map((u) => (
              <TR key={u.id}>
                <TD className="font-medium">
                  {/* The name is the row's primary link, so phones need no trailing column. */}
                  <Link href={`/admin/users/${u.id}`} className="break-all hover:underline" dir="auto">
                    {u.username}
                  </Link>
                  <span className="block text-sm font-normal text-muted sm:hidden">
                    {USER_ROLE_LABELS[u.role]}
                    {u.courseType ? ` · ${COURSE_LABELS[u.courseType]}` : ""}
                  </span>
                </TD>
                <TD className="hidden text-muted sm:table-cell">{u.courseType ? COURSE_LABELS[u.courseType] : "—"}</TD>
                <TD className="hidden text-muted sm:table-cell">{USER_ROLE_LABELS[u.role]}</TD>
                <TD className="text-muted tabular-nums">{u.traineeCount}</TD>
                <TD className="hidden text-muted tabular-nums md:table-cell">{formatDate(u.createdAt)}</TD>
                <TD className="hidden text-end sm:table-cell">
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="inline-flex items-center gap-1 text-sm font-medium text-ink hover:underline"
                  >
                    פרטים
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <p className="text-xs text-muted">
        מוצגים {filtered.length} מתוך {users.length} משתמשים
      </p>
    </div>
  );
}
