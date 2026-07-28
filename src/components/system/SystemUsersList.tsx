"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Crown } from "lucide-react";
import { Field, Input, Select, Panel, Table, THead, TBody, TR, TH, TD, EmptyState } from "@/components/ui";
import { FilterPopover } from "@/components/ui/FilterPopover";
import {
  COURSE_LABELS,
  USER_ROLE_LABELS,
  USER_STATUS_LABELS,
  ADMIN_POSITION_LABELS,
  type UserRole,
  type UserStatus,
  type AdminPosition,
  type CourseType,
} from "@/lib/domain/types";

type Row = {
  id: string;
  displayName: string;
  username: string;
  role: UserRole;
  isRootSuperAdmin: boolean;
  status: UserStatus;
  adminPosition: AdminPosition | null;
  courseType: CourseType | null;
  traineeCount: number;
};

function toRole(v: string | null): "all" | UserRole {
  return v === "staff" || v === "admin" || v === "super_admin" ? v : "all";
}
function toStatus(v: string | null): "all" | UserStatus {
  return v === "active" || v === "suspended" || v === "disabled" ? v : "all";
}

export function SystemUsersList({ users }: { users: Row[] }) {
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [role, setRole] = useState<"all" | UserRole>(toRole(params.get("role")));
  const [status, setStatus] = useState<"all" | UserStatus>(toStatus(params.get("status")));

  // Mirror the filter to URL params without a re-fetch (§39 — shareable/persistent).
  function syncUrl(next: Partial<{ q: string; role: string; status: string }>) {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const apply = (k: string, v: string) => {
      if (v && v !== "all") sp.set(k, v);
      else sp.delete(k);
    };
    apply("q", next.q ?? search);
    apply("role", next.role ?? role);
    apply("status", next.status ?? status);
    const qs = sp.toString();
    window.history.replaceState(null, "", qs ? `${window.location.pathname}?${qs}` : window.location.pathname);
  }

  const activeCount = (role !== "all" ? 1 : 0) + (status !== "all" ? 1 : 0);
  function clearFilters() {
    setRole("all");
    setStatus("all");
    syncUrl({ role: "all", status: "all" });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (role !== "all" && u.role !== role) return false;
      if (status !== "all" && u.status !== status) return false;
      if (q && !`${u.displayName} ${u.username}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [users, search, role, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="חיפוש לפי שם או שם משתמש…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            syncUrl({ q: e.target.value });
          }}
          className="max-w-xs"
        />
        <FilterPopover activeCount={activeCount} onClear={clearFilters}>
          <Field label="תפקיד" htmlFor="filter-role">
            <Select
              id="filter-role"
              value={role}
              onChange={(e) => {
                const v = e.target.value as "all" | UserRole;
                setRole(v);
                syncUrl({ role: v });
              }}
            >
              <option value="all">כל התפקידים</option>
              <option value="staff">{USER_ROLE_LABELS.staff}</option>
              <option value="admin">{USER_ROLE_LABELS.admin}</option>
              <option value="super_admin">{USER_ROLE_LABELS.super_admin}</option>
            </Select>
          </Field>
          <Field label="סטטוס" htmlFor="filter-status">
            <Select
              id="filter-status"
              value={status}
              onChange={(e) => {
                const v = e.target.value as "all" | UserStatus;
                setStatus(v);
                syncUrl({ status: v });
              }}
            >
              <option value="all">כל הסטטוסים</option>
              <option value="active">{USER_STATUS_LABELS.active}</option>
              <option value="suspended">{USER_STATUS_LABELS.suspended}</option>
              <option value="disabled">{USER_STATUS_LABELS.disabled}</option>
            </Select>
          </Field>
        </FilterPopover>
        <span className="text-sm text-muted">{filtered.length} משתמשים</span>
      </div>

      <Panel className="p-0">
        {filtered.length === 0 ? (
          <EmptyState title="אין תוצאות" description="נסה לשנות את הסינון." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>שם</TH>
                <TH>תפקיד</TH>
                <TH>קורס</TH>
                <TH>סטטוס</TH>
                <TH>חניכים</TH>
                <TH><span className="sr-only">פעולות</span></TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((u) => (
                <TR key={u.id}>
                  <TD className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {u.displayName || u.username}
                      {u.isRootSuperAdmin ? <Crown className="h-3.5 w-3.5 text-amber-500" aria-label="מנהל־על ראשי" /> : null}
                    </span>
                    <span className="block text-xs text-subtle">{u.username}</span>
                  </TD>
                  <TD className="text-muted">
                    {USER_ROLE_LABELS[u.role]}
                    {u.adminPosition ? ` · ${ADMIN_POSITION_LABELS[u.adminPosition]}` : ""}
                  </TD>
                  <TD className="text-muted">{u.courseType ? COURSE_LABELS[u.courseType] : "—"}</TD>
                  <TD className="text-muted">{USER_STATUS_LABELS[u.status]}</TD>
                  <TD className="text-muted tabular-nums">{u.traineeCount}</TD>
                  <TD className="text-end">
                    <Link href={`/system/users/${u.id}`} className="text-sm font-medium text-ink hover:underline">
                      ניהול
                    </Link>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
