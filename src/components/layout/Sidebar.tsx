"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, Check, ChevronLeft, Crown, Pencil, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NO_COHORT } from "@/lib/workspace/nav";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { UserMenu } from "@/components/layout/UserMenu";
import { COURSE_LABELS, isAdminRole, type CourseType, type RootProfile, type UserRole } from "@/lib/domain/types";
import type { NavCohort, NavCourse, WorkspaceNav } from "@/lib/data/workspace-nav";

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
  courseType?: CourseType | null;
  role?: UserRole;
  rootProfile?: RootProfile | null;
  username?: string;
  nav?: WorkspaceNav | null;
  onOpenDirectory?: () => void;
};

/* --- cohort management (managers) --------------------------------------- */
async function cohortApi(url: string, method: "POST" | "PATCH", body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? "הפעולה נכשלה.";
  } catch {
    return "החיבור לשרת נכשל.";
  }
}

const DARK_INPUT =
  "h-8 w-full rounded-md border border-slate-700 bg-slate-800 px-2 text-sm text-slate-100 placeholder:text-slate-500 focus-visible:border-slate-400 focus-visible:outline-none";
const ICON_BTN = "grid h-6 w-6 place-items-center rounded text-slate-400 transition-colors hover:bg-slate-800 hover:text-white";

function CohortRow({
  cohort,
  href,
  active,
  canManage,
  onNavigate,
  onChanged,
}: {
  cohort: NavCohort;
  href: string;
  active: boolean;
  canManage: boolean;
  onNavigate?: () => void;
  onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(cohort.name);
  const [busy, setBusy] = useState(false);

  async function rename() {
    if (!name.trim()) return;
    setBusy(true);
    const err = await cohortApi(`/api/admin/cohorts/${cohort.id}`, "PATCH", { name: name.trim() });
    setBusy(false);
    if (!err) {
      setRenaming(false);
      onChanged();
    }
  }
  async function archive() {
    setBusy(true);
    const err = await cohortApi(`/api/admin/cohorts/${cohort.id}`, "PATCH", { status: "archived" });
    setBusy(false);
    if (!err) onChanged();
  }

  if (renaming) {
    return (
      <li className="flex items-center gap-1 px-1 py-0.5">
        <input value={name} onChange={(e) => setName(e.target.value)} className={DARK_INPUT} aria-label="שם מחזור" autoFocus disabled={busy} />
        <button type="button" onClick={rename} className={ICON_BTN} aria-label="שמירה" disabled={busy}><Check className="h-4 w-4" aria-hidden="true" /></button>
        <button type="button" onClick={() => { setRenaming(false); setName(cohort.name); }} className={ICON_BTN} aria-label="ביטול" disabled={busy}><X className="h-4 w-4" aria-hidden="true" /></button>
      </li>
    );
  }

  return (
    <li className="group flex items-center gap-1">
      <Link
        href={href}
        onClick={onNavigate}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex min-w-0 flex-1 items-center rounded-lg px-3 py-1.5 text-sm text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-100",
          active ? "bg-slate-700 font-medium text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
        )}
      >
        <span className="truncate">{cohort.name}</span>
      </Link>
      {canManage ? (
        <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" onClick={() => setRenaming(true)} className={ICON_BTN} aria-label={`שינוי שם ${cohort.name}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
          <button type="button" onClick={archive} className={ICON_BTN} aria-label={`העברת ${cohort.name} לארכיון`} disabled={busy}><Archive className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </span>
      ) : null}
    </li>
  );
}

function CourseBlock({
  course,
  active,
  canManage,
  onNavigate,
  onChanged,
}: {
  course: NavCourse;
  active: string | null;
  canManage: boolean;
  onNavigate?: () => void;
  onChanged: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    const err = await cohortApi(`/api/admin/cohorts`, "POST", { courseId: course.id, name: newName.trim() });
    setBusy(false);
    if (!err) {
      setCreating(false);
      setNewName("");
      onChanged();
    }
  }
  async function restore(id: string) {
    const err = await cohortApi(`/api/admin/cohorts/${id}`, "PATCH", { status: "active" });
    if (!err) onChanged();
  }

  return (
    <div>
      <div className="flex items-center justify-between px-3 pb-1.5">
        <p className="text-xs font-semibold tracking-wider text-slate-400">{course.name}</p>
        {canManage ? (
          <button type="button" onClick={() => setCreating((v) => !v)} className={ICON_BTN} aria-label={`מחזור חדש ב${course.name}`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {creating ? (
        <div className="flex items-center gap-1 px-1 pb-1">
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="שם מחזור" className={DARK_INPUT} aria-label="שם מחזור חדש" autoFocus disabled={busy} />
          <button type="button" onClick={create} className={ICON_BTN} aria-label="יצירה" disabled={busy}><Check className="h-4 w-4" aria-hidden="true" /></button>
          <button type="button" onClick={() => { setCreating(false); setNewName(""); }} className={ICON_BTN} aria-label="ביטול" disabled={busy}><X className="h-4 w-4" aria-hidden="true" /></button>
        </div>
      ) : null}

      <ul className="space-y-0.5">
        {course.cohorts.map((k) => (
          <CohortRow key={k.id} cohort={k} href={`/workspace?cohort=${k.id}`} active={active === k.id} canManage={canManage} onNavigate={onNavigate} onChanged={onChanged} />
        ))}
        {course.hasUnassigned ? (
          <li>
            <Link
              href={`/workspace?cohort=${NO_COHORT}`}
              onClick={onNavigate}
              aria-current={active === NO_COHORT ? "true" : undefined}
              className={cn(
                "flex items-center rounded-lg px-3 py-1.5 text-sm text-start transition-colors",
                active === NO_COHORT ? "bg-slate-700 font-medium text-white" : "text-slate-300 hover:bg-slate-800/60 hover:text-white",
              )}
            >
              <span className="truncate">ללא שיוך למחזור</span>
            </Link>
          </li>
        ) : null}
        {course.cohorts.length === 0 && !course.hasUnassigned ? (
          <li className="px-3 py-1.5 text-xs text-slate-500">אין מחזורים</li>
        ) : null}
      </ul>

      {canManage && course.archivedCohorts.length > 0 ? (
        <div className="mt-1">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="flex items-center gap-1 px-3 py-1 text-xs text-slate-500 hover:text-slate-300">
            <ChevronLeft className={cn("h-3 w-3 transition-transform", showArchived && "-rotate-90")} aria-hidden="true" />
            בארכיון ({course.archivedCohorts.length})
          </button>
          {showArchived ? (
            <ul className="space-y-0.5">
              {course.archivedCohorts.map((k) => (
                <li key={k.id} className="flex items-center gap-1 px-3 py-1 text-sm text-slate-400">
                  <span className="min-w-0 flex-1 truncate">{k.name}</span>
                  <button type="button" onClick={() => restore(k.id)} className={ICON_BTN} aria-label={`שחזור ${k.name}`}><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /></button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The COURSE → COHORT tree — the sidebar's only navigation (+ inline management for
 *  managers). Client-only (reads the live `?cohort=`), wrapped in Suspense by Sidebar. */
function CohortTree({ nav, onNavigate }: { nav: WorkspaceNav; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const onWorkspace = pathname === "/workspace";
  const active = onWorkspace ? searchParams.get("cohort") ?? nav.activeCohortId : null;
  const onChanged = () => router.refresh();

  if (nav.courses.length === 0) {
    return <p className="px-3 py-2 text-xs text-slate-400">אין קורסים או מחזורים להצגה.</p>;
  }

  return (
    <div className="space-y-4">
      {nav.courses.map((course) => (
        <CourseBlock
          key={course.id}
          course={course}
          active={active}
          canManage={nav.canManageCohorts}
          onNavigate={onNavigate}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

/**
 * The persistent navigation rail (RTL: right). Focused ONLY on courses/cohorts — the
 * brand, the course→cohort tree (with inline cohort management for managers), and a
 * single user-menu footer. Settings, administration, notifications, and access requests
 * are NOT here — they live in the user menu / management area.
 */
export function Sidebar({ className, onNavigate, courseType, role, rootProfile, username, nav }: SidebarProps) {
  const platformOwner = rootProfile === "platform_owner";
  const home = platformOwner ? "/system/users" : "/workspace";
  const manager = role ? isAdminRole(role) : false;
  const managementHref = role === "super_admin" ? "/system/users" : "/admin/users";

  return (
    <aside className={cn("w-64 shrink-0 border-e border-slate-800 bg-slate-900 text-slate-100", className)}>
      <div className="flex h-full flex-col">
        {/* Brand */}
        <Link
          href={home}
          onClick={onNavigate}
          className="flex h-16 items-center border-b border-slate-800 px-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-100"
        >
          <span className="flex items-center gap-1.5">
            <BrandWordmark tone="onDark" size="md" />
            {rootProfile === "school_commander" ? (
              <Crown className="h-4 w-4 shrink-0 text-amber-300" aria-label="מפקד בית הספר" />
            ) : null}
          </span>
        </Link>

        {/* Body — course/cohort tree only */}
        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="קורסים ומחזורים">
          {nav && !platformOwner ? (
            <Suspense fallback={<p className="px-3 py-2 text-xs text-slate-400">טוען מחזורים…</p>}>
              <CohortTree nav={nav} onNavigate={onNavigate} />
            </Suspense>
          ) : (
            <p className="px-3 py-2 text-xs text-slate-400">ניהול המערכת זמין מתפריט המשתמש למטה.</p>
          )}
        </nav>

        {/* Footer — the single user menu (settings/updates/management/logout live inside) */}
        <div className="border-t border-slate-800 px-3 py-3">
          {username ? <UserMenu username={username} manager={manager} managementHref={managementHref} className="w-full justify-between" /> : null}
          <p className="px-1 pt-2 text-xs text-slate-500">
            סגל ההדרכה{courseType ? ` · ${COURSE_LABELS[courseType]}` : ""}
          </p>
        </div>
      </div>
    </aside>
  );
}
