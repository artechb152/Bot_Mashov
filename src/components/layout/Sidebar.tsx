"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, Check, ChevronLeft, Contact, Crown, Pencil, Plus, RotateCcw, ShieldCheck, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NO_COHORT } from "@/lib/workspace/nav";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { UserMenu } from "@/components/layout/UserMenu";
import { NotificationBell, RAIL_ITEM } from "@/components/notifications/NotificationBell";
import { COURSE_LABELS, USER_ROLE_LABELS, isAdminRole, type CourseType, type RootProfile, type UserRole } from "@/lib/domain/types";
import type { NavCohort, NavCourse, WorkspaceNav } from "@/lib/data/workspace-nav";

type SidebarProps = {
  className?: string;
  onNavigate?: () => void;
  courseType?: CourseType | null;
  role?: UserRole;
  rootProfile?: RootProfile | null;
  username?: string;
  nav?: WorkspaceNav | null;
  /** Opens the people-directory flyout (available to every active user). */
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
  "h-10 w-full rounded-lg border border-rail-line bg-rail-hover px-2.5 text-base text-rail-ink placeholder:text-rail-muted focus-visible:border-rail-ink focus-visible:outline-none sm:text-sm";
const ICON_BTN =
  "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rail-muted transition-colors hover:bg-rail-hover hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-ink disabled:opacity-50";
const COHORT_LINK =
  "flex min-h-10 min-w-0 flex-1 items-center rounded-lg px-3 py-2 text-sm text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rail-ink";

function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="px-3 pb-1 text-xs text-red-200">
      {message}
    </p>
  );
}

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
  const [error, setError] = useState<string | null>(null);

  async function rename() {
    if (!name.trim()) return;
    setBusy(true);
    const err = await cohortApi(`/api/admin/cohorts/${cohort.id}`, "PATCH", { name: name.trim() });
    setBusy(false);
    setError(err);
    if (!err) {
      setRenaming(false);
      onChanged();
    }
  }
  async function archive() {
    if (!window.confirm(`להעביר את „${cohort.name}” לארכיון? אפשר לשחזר אותו מאוחר יותר.`)) return;
    setBusy(true);
    const err = await cohortApi(`/api/admin/cohorts/${cohort.id}`, "PATCH", { status: "archived" });
    setBusy(false);
    setError(err);
    if (!err) onChanged();
  }

  if (renaming) {
    return (
      <li>
        <form
          className="flex items-center gap-1 px-1 py-0.5"
          onSubmit={(e) => {
            e.preventDefault();
            void rename();
          }}
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setRenaming(false);
                setName(cohort.name);
              }
            }}
            className={DARK_INPUT}
            aria-label="שם המחזור"
            autoFocus
            disabled={busy}
          />
          <button type="submit" className={ICON_BTN} aria-label="שמירת השם" disabled={busy}>
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => { setRenaming(false); setName(cohort.name); }} className={ICON_BTN} aria-label="ביטול" disabled={busy}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
        <InlineError message={error} />
      </li>
    );
  }

  return (
    <li>
      <div className="group flex items-center gap-0.5">
        <Link
          href={href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            COHORT_LINK,
            active ? "bg-rail-active font-semibold text-rail-ink" : "text-rail-ink/85 hover:bg-rail-hover hover:text-rail-ink",
          )}
        >
          <span className="truncate" dir="auto">{cohort.name}</span>
        </Link>
        {canManage ? (
          // Revealed on hover/focus with a pointer; always visible on touch screens.
          <span className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            <button type="button" onClick={() => setRenaming(true)} className={ICON_BTN} aria-label={`שינוי שם המחזור ${cohort.name}`}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={archive} className={ICON_BTN} aria-label={`העברת ${cohort.name} לארכיון`} disabled={busy}>
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : null}
      </div>
      <InlineError message={error} />
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
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    const err = await cohortApi(`/api/admin/cohorts`, "POST", { courseId: course.id, name: newName.trim() });
    setBusy(false);
    setError(err);
    if (!err) {
      setCreating(false);
      setNewName("");
      onChanged();
    }
  }
  async function restore(id: string) {
    const err = await cohortApi(`/api/admin/cohorts/${id}`, "PATCH", { status: "active" });
    setError(err);
    if (!err) onChanged();
  }

  return (
    <div>
      <div className="flex min-h-9 items-center justify-between gap-2 ps-3">
        <h3 className="truncate text-xs font-semibold text-rail-muted">{course.name}</h3>
        {canManage ? (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className={ICON_BTN}
            aria-expanded={creating}
            aria-label={`מחזור חדש ב${course.name}`}
            title="מחזור חדש"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {creating ? (
        <form
          className="flex items-center gap-1 px-1 pb-1"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setCreating(false);
                setNewName("");
              }
            }}
            placeholder="שם המחזור"
            className={DARK_INPUT}
            aria-label="שם מחזור חדש"
            autoFocus
            disabled={busy}
          />
          <button type="submit" className={ICON_BTN} aria-label="יצירת המחזור" disabled={busy}>
            <Check className="h-4 w-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => { setCreating(false); setNewName(""); }} className={ICON_BTN} aria-label="ביטול" disabled={busy}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      ) : null}
      <InlineError message={error} />

      <ul className="space-y-0.5">
        {course.cohorts.map((k) => (
          <CohortRow key={k.id} cohort={k} href={`/workspace?cohort=${k.id}`} active={active === k.id} canManage={canManage} onNavigate={onNavigate} onChanged={onChanged} />
        ))}
        {course.hasUnassigned ? (
          <li>
            <Link
              href={`/workspace?cohort=${NO_COHORT}`}
              onClick={onNavigate}
              aria-current={active === NO_COHORT ? "page" : undefined}
              className={cn(
                COHORT_LINK,
                active === NO_COHORT ? "bg-rail-active font-semibold text-rail-ink" : "text-rail-ink/85 hover:bg-rail-hover hover:text-rail-ink",
              )}
            >
              <span className="truncate">ללא שיוך למחזור</span>
            </Link>
          </li>
        ) : null}
        {course.cohorts.length === 0 && !course.hasUnassigned ? (
          <li className="px-3 py-2 text-sm text-rail-muted">אין מחזורים פעילים</li>
        ) : null}
      </ul>

      {canManage && course.archivedCohorts.length > 0 ? (
        <div className="mt-1">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            aria-expanded={showArchived}
            className="flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-rail-muted transition-colors hover:text-rail-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rail-ink"
          >
            <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform", showArchived && "-rotate-90")} aria-hidden="true" />
            מחזורים בארכיון ({course.archivedCohorts.length})
          </button>
          {showArchived ? (
            <ul className="space-y-0.5">
              {course.archivedCohorts.map((k) => (
                <li key={k.id} className="flex items-center gap-1 ps-3 text-sm text-rail-muted">
                  <span className="min-w-0 flex-1 truncate" dir="auto">{k.name}</span>
                  <button type="button" onClick={() => restore(k.id)} className={ICON_BTN} aria-label={`שחזור ${k.name}`} title="שחזור">
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The COURSE → COHORT tree (+ inline management for managers). Client-only (reads
 *  the live `?cohort=`), wrapped in Suspense by Sidebar. */
function CohortTree({ nav, onNavigate }: { nav: WorkspaceNav; onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const onWorkspace = pathname === "/workspace";
  const active = onWorkspace ? searchParams.get("cohort") ?? nav.activeCohortId : null;
  const onChanged = () => router.refresh();

  if (nav.courses.length === 0) {
    return <p className="px-3 py-2 text-sm text-rail-muted">אין קורסים או מחזורים להצגה.</p>;
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
 * The persistent navigation rail (RTL: right), one hierarchy for every role:
 *   1. Work — the course → cohort tree that drives /workspace (managers edit inline).
 *   2. General — people directory (flyout), updates (popover with unread count) and,
 *      for admin/super only, the management area. Server routes still enforce every
 *      permission; these are only entry points.
 *   3. Account — the user menu (profile & settings, logout).
 */
export function Sidebar({ className, onNavigate, courseType, role, rootProfile, username, nav, onOpenDirectory }: SidebarProps) {
  const pathname = usePathname();
  const platformOwner = rootProfile === "platform_owner";
  const home = platformOwner ? "/system/users" : "/workspace";
  const manager = role ? isAdminRole(role) : false;
  const managementHref = role === "super_admin" ? "/system/users" : "/admin/users";
  const inManagement = pathname.startsWith("/admin") || pathname.startsWith("/system");
  const subtitle = [role ? USER_ROLE_LABELS[role] : null, courseType ? COURSE_LABELS[courseType] : null].filter(Boolean).join(" · ");

  return (
    <aside className={cn("w-64 shrink-0 border-e border-rail-line bg-rail text-rail-ink", className)}>
      <div className="flex h-full flex-col">
        {/* Brand */}
        <Link
          href={home}
          onClick={onNavigate}
          className="flex h-16 shrink-0 items-center px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rail-ink"
        >
          <span className="flex items-center gap-1.5">
            <BrandWordmark tone="onDark" size="sm" />
            {rootProfile === "school_commander" ? (
              <Crown className="h-4 w-4 shrink-0 text-amber-300" aria-label="מפקד בית הספר" />
            ) : null}
          </span>
        </Link>

        {/* Work: course/cohort tree */}
        <nav className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-rail-line px-3 py-4" aria-label="קורסים ומחזורים">
          {nav && !platformOwner ? (
            <Suspense fallback={<p className="px-3 py-2 text-sm text-rail-muted">טוען מחזורים…</p>}>
              <CohortTree nav={nav} onNavigate={onNavigate} />
            </Suspense>
          ) : (
            <p className="px-3 py-2 text-sm text-rail-muted">אין מרחב עבודה אישי לחשבון זה. ניהול המערכת זמין למטה.</p>
          )}
        </nav>

        {/* General */}
        <div className="shrink-0 space-y-0.5 border-t border-rail-line px-3 py-3" role="group" aria-label="כללי">
          {onOpenDirectory ? (
            <button type="button" onClick={onOpenDirectory} aria-haspopup="dialog" className={cn(RAIL_ITEM, "text-rail-ink/90 hover:bg-rail-hover hover:text-rail-ink")}>
              <Contact className="h-5 w-5 shrink-0 text-rail-muted" aria-hidden="true" />
              אנשי המערכת
            </button>
          ) : null}
          <NotificationBell variant="rail" />
          {manager ? (
            <Link
              href={managementHref}
              onClick={onNavigate}
              aria-current={inManagement ? "page" : undefined}
              className={cn(RAIL_ITEM, inManagement ? "bg-rail-active text-rail-ink" : "text-rail-ink/90 hover:bg-rail-hover hover:text-rail-ink")}
            >
              <ShieldCheck className="h-5 w-5 shrink-0 text-rail-muted" aria-hidden="true" />
              ניהול המערכת
            </Link>
          ) : null}
        </div>

        {/* Account */}
        <div className="shrink-0 border-t border-rail-line px-3 py-3">
          {username ? <UserMenu username={username} subtitle={subtitle || undefined} tone="rail" /> : null}
        </div>
      </div>
    </aside>
  );
}
