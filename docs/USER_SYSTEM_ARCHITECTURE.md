# מצפן — User System Architecture

Status: living document. Describes the user-management, organizational-hierarchy,
messaging, access-request and administration system being integrated into the
existing מצפן codebase in controlled phases.

> Scope note: מצפן is used **only by course staff and commanders** — never by
> trainees. "User" below always means a staff/admin/super-admin account.

---

## 1. Roles and the protected root tier

```ts
type UserRole = "staff" | "admin" | "super_admin";
```

`isRootSuperAdmin: boolean` is an **orthogonal protected flag**, not a fourth role.
A root super-admin is `{ role: "super_admin", isRootSuperAdmin: true }`.

| Concept | Field | Notes |
|---|---|---|
| System permission | `role` | staff / admin / super_admin |
| Protected root | `isRootSuperAdmin` | only super_admins can be root; created only by the local bootstrap script |
| Admin display position | `adminPosition` | `course_commander` (מק״ס) / `deputy_course_commander` (סמק״ס) — **display/filter only**, both use the `admin` role |
| Account status | `status` | `active` / `suspended` / `disabled` — there is **no user deletion** |
| Directory visibility | `directoryVisibility` | `visible` / `hidden` — hidden hides from directory & recipient search only, never from audit |

### Root protection (enforced server-side, first guard in every mutation)
A `isRootSuperAdmin: true` account can never be, via any website API: deleted,
disabled, suspended, demoted, un-rooted, or role-changed. Root lifecycle is 100%
the local script `scripts/create-root.ts` (`npm run admin:create-root`). The site
never exposes a route that creates a root.

Two roots are expected in production: the project owner (hidden) and the school
commander (visible, crown). The crown icon is **display-only**, driven by
`isRootSuperAdmin === true`; it is never an authorization mechanism.

---

## 2. Why privilege is read DB-fresh, never from the JWT

The signed session cookie (`matzpen_session`, `jose` HS256, 7-day) proves
**identity only** — `sub`(id), `username`, `courseType`. `role`, `status`,
`isRootSuperAdmin` are **re-read from MongoDB on every request** by
`getAccount()` (`src/lib/auth/account.ts`, React `cache()`-memoized, default-deny).

Consequences (all desirable, all preserved):
- A demoted/suspended user loses access on their **next request** — stronger than
  the spec's "next login" floor, and it needs no session-revocation machinery.
- `role` is deliberately absent from `SessionUser`, so `user.role` is a compile
  error — nobody can authorize off the stale token.
- This is **not** live session revocation: we re-read a DB field, we don't revoke
  the JWT. No WebSockets / authVersion / sessionVersion were added.

---

## 3. Authorization: the grant hierarchy

Server-only, composable, branded capabilities (a branded value cannot be forged —
only the module's private constructor makes one):

```
requireActiveUser()      → AuthGrant   any active authenticated user
requireScope()           → OwnerScope  active user WITH a course (staff data plane)
requireAdmin()           → AdminGrant  active admin OR super_admin; carries courseScope
requireSuperAdmin()      → AdminGrant  guaranteed courseScope === null (global)
requireRootSuperAdmin()  → RootGrant   active root super_admin only
```

`AdminGrant` is **generalized, not forked**: both `admin` and `super_admin`
satisfy it, so the unscoped management data layer (`src/lib/data/admin.ts`)
accepts a single branded type. The distinction is `grant.courseScope`:
`null` = global (super_admin/root), set = course-bound (plain admin). Higher-level
semantic gates (`src/lib/auth/access.ts`): `requireTraineeAccess`,
`requireUserManagementAccess`. Pure, unit-testable policy
(`src/lib/auth/policy.ts`): `canChangeRole`, `canChangeStatus`.

Account status is enforced in the **grant constructors and the login route** — not
by nulling `getAccount()` — so suspended/disabled users reach a clear Hebrew
surface but no data gate ever passes them.

---

## 4. Organizational hierarchy

```
Course ──< Cohort ──< Team
                └──< UserAssignment (assignment history, one current per user)
```

- **Course** — `code` is the existing `CourseType` enum (`kapeh`/`maksim`), so
  `courseType ↔ courseId` map deterministically. Idempotent `ensureCourses()`
  (upsert + `$setOnInsert` on unique `code`) — safe to run repeatedly, never resets.
- **Cohort** — a course cycle. `status: planned|active|archived`, `isLocked`.
  Archived cohorts stay in place (archive is a *status*, not a separate collection).
- **Team** — belongs to one cohort; the team's course must equal the cohort's course.
- **UserAssignment** — `isCurrent` history. Moving a staff user closes the old
  current assignment and opens a new one; old assignments are never deleted.

---

## 5. Trainee ownership, cohorts, archives

Ownership stays anchored on the existing **`commanderId`** (the canonical owner,
load-bearing in the hot authz path and the compound index). Added **additively**
(all optional/defaulted so existing docs validate):

| Field | Meaning |
|---|---|
| `ownerId` | denormalized mirror of `commanderId` (kept equal) |
| `originalOwnerId` | write-once, preserved across transfers |
| `createdBy`, `lastUpdatedBy` | audit trail |
| `courseId`, `cohortId`, `teamId` | org placement (carried; `courseType` stays the authoritative scope key) |
| `status` | `active` / `archived` |
| `cohortLocked` | denormalized from `Cohort.isLocked`; enforces staff read-only-in-locked-cohort in the write filter (atomic, no TOCTOU) |

**Access model** (see RBAC_MATRIX.md): staff = owner-only (sharing a team never
widens access); admin = course-scoped; super_admin = global. **Ownership transfer**
is a separate, explicitly-gated function (never folded into content update):
preserves `originalOwnerId`, requires a reason, audits before/after, re-homes the
trainee's attachments.

---

## 6. courseType → courseId: additive, not a cutover

`courseType` (string enum) remains the **authoritative scope key** and stays in the
JWT and every `scopeFilter`, hitting the existing compound index. `courseId` is
**carried everywhere but not filtered on for authz** during this transition. This
keeps rollback trivial and avoids an index rebuild / big-bang query rewrite. A
later, out-of-scope phase may flip reads to `{ commanderId, courseId, createdAt }`
via `syncIndexes()`, keeping `courseType` as a written mirror.

---

## 7. Admin invites (replacing the shared static code)

The permanent `ADMIN_SIGNUP_CODE` env var is retired. Admin accounts are created
via **`AdminInvite`**: per-course, one-time, expiring, revocable, stored only as a
SHA-256 hash of a high-entropy `ADM-XXXX-XXXX-XXXX` code (Node `crypto`). The
plaintext is shown **once** at creation and never stored/logged/echoed/put in a URL.
Any super-admin can issue an `admin` invite; **invites never create super-admins**
(that is a root-only manual promotion).

---

## 8. Supporting systems

- **AuditLog** — every privileged mutation writes `{ actor, action, targetType,
  targetId, before, after, reason }`. Never stores secrets. Hidden-owner actions
  still appear (never anonymous).
- **Internal messaging** — professional inbox (Thread / Message / per-user
  ParticipantState). Group recipients resolved to concrete user IDs **at send time**
  (snapshot). No real-time/WebSockets. A trainee *reference* never grants trainee
  *access*.
- **Access requests** — typed requests with server-chosen reviewers, cooldowns,
  and duplicate-open guards. `admin_role_request` can never yield super_admin.
- **Notifications** — lightweight in-app unread counts. No browser push.

---

## 9. Current data snapshot (inspected 2026-07-15)

- DB `matzpen`: **1 user** (`עידו גרשון`, role staff, course maksim — a real,
  non-test account that must not be auto-modified), **0 trainees**, **0
  attachments**. No org/invite/audit collections yet. Content collections
  (simulations/scenarios/knowledge) are unrelated and untouched.
- **No orphaned trainee records exist** → no trainee backfill decision needed.
  A dry-run backfill script (`scripts/backfill-org.ts`) is provided for any future
  legacy data; it is **not run automatically**.

---

## 10. Non-negotiable constraints

No real AI / AI SDK / external API keys / `NEXT_PUBLIC_` secrets. No destructive
migrations or DB resets. No user deletion. Hebrew RTL preserved. Visual identity
per `DESIGN.md` (monochrome slate, Tailwind v4 CSS-first, tables-over-cards, RTL
logical utilities, hand-rolled `ui/` primitives). All authorization server-side.
