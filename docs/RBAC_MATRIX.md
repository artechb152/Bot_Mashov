# מצפן — RBAC Capability Matrix

Living reference for who can do what. **All checks are server-side.** The UI hides
controls a user cannot use, but hiding is never the enforcement.

Roles: `staff`, `admin`, `super_admin`. Orthogonal flag: `isRootSuperAdmin`.
"Root" below = `super_admin` with `isRootSuperAdmin: true`.

Legend: ✅ allowed · ⛔ denied · 🟡 scoped/conditional (see notes).

---

## Trainees & documents

| Capability | staff | admin | super_admin | root |
|---|---|---|---|---|
| Create trainee | 🟡 own current course/cohort/team | ✅ own course | ✅ any | ✅ any |
| View trainee | 🟡 own only | 🟡 own course | ✅ any | ✅ any |
| Edit trainee | 🟡 own & cohort unlocked | 🟡 own course | ✅ any | ✅ any |
| View own historical (prev cohort) | ✅ records they owned | 🟡 own course | ✅ | ✅ |
| Edit historical | 🟡 unless cohort locked | 🟡 own course | ✅ | ✅ |
| Upload/download/delete documents | 🟡 trainees they manage | 🟡 own course | ✅ | ✅ |
| Transfer trainee ownership | ⛔ | 🟡 within own course | ✅ any | ✅ |
| Access other staff's trainee by URL | ⛔ (404) | 🟡 own course only | ✅ | ✅ |

Staff safe-default: a staff user keeps access to trainees **they personally owned**
in earlier cohorts; they do **not** gain access to every historical record of a team
just because they are currently on that team.

## Cohorts & teams

| Capability | staff | admin | super_admin |
|---|---|---|---|
| View cohorts | 🟡 own assignments/owned trainees | ✅ own course | ✅ all |
| Create/edit/archive/restore cohort | ⛔ | 🟡 own course | ✅ all |
| Lock / unlock cohort | ⛔ | 🟡 own course | ✅ all |
| Edit in locked cohort | ⛔ (read-only) | ✅ (lock targets staff) | ✅ |
| Create/edit/disable team | ⛔ | 🟡 own course | ✅ all |

## Users & directory

| Capability | staff | admin | super_admin | root |
|---|---|---|---|---|
| See directory | 🟡 same course + admins + visible super-admins | 🟡 hierarchy, detail for own course | ✅ all visible | ✅ |
| Open staff detail page | ⛔ | 🟡 own-course staff | ✅ | ✅ |
| Edit user status (suspend/disable) | ⛔ | ⛔ | 🟡 non-root targets | 🟡 non-root |
| Edit user course/cohort/team/position/visibility | ⛔ | ⛔ | ✅ non-root | ✅ non-root |
| Edit user username/password | 🟡 own only | ⛔ (others) | ⛔ (others) | ⛔ (others) |
| See the hidden project-owner ghost | ⛔ | ⛔ | ⛔ (directory/search) | 🟡 root maintenance/audit only |

## Roles (who may change roles)

| Transition | Who may perform |
|---|---|
| staff ↔ admin | **root only** |
| staff/admin → super_admin | **root only** |
| regular super_admin → admin/staff | **root only** |
| any change to a `isRootSuperAdmin` account | **nobody via API** (bootstrap script only) |
| create a root | **nobody via API** (bootstrap script only) |

Notes: role changes take effect on the target's next request (DB-fresh reads).
Promotions to admin require a course + admin position; demotions require the target
role's required context (course/cohort/team as applicable) + a reason + confirmation.
The **last active manager** (`role ∈ {admin, super_admin}`, `status: active`) cannot
be demoted/suspended/disabled. Self-demotion out of a management role requires an
extra confirm.

## Invites

| Capability | staff | admin | super_admin | root |
|---|---|---|---|---|
| Create `admin` invite (per course, one-time) | ⛔ | ⛔ | ✅ | ✅ |
| Revoke an unused invite | ⛔ | ⛔ | ✅ | ✅ |
| Create a `super_admin` via invite | ⛔ | ⛔ | ⛔ | ⛔ (never — root-only manual promotion) |

## Messaging

| Recipient reachable by → | staff | admin | super_admin |
|---|---|---|---|
| Staff in same course | ✅ visible | ✅ | ✅ |
| Teams in same course | ✅ permitted | ✅ all | ✅ |
| Whole course broadcast | ⛔ (unless allowed) | ✅ own course | ✅ any |
| Admins in same course | ✅ | ✅ | ✅ |
| Admins in other course | ⛔ | ✅ | ✅ |
| Super-admins directly | ⛔ (use "פנייה להנהלת המערכת") | 🟡 visible only | ✅ |
| Staff in another course | ⛔ | ⛔ | ✅ |
| Disabled/suspended/hidden users | ⛔ | ⛔ | ⛔ (except system/account notices) |

## Access requests (typical reviewer)

| Request type | Reviewer |
|---|---|
| trainee_view / trainee_edit / team_change / cohort_change | admins in the requester's course |
| course_change / account_reactivation / admin_role_request | super_admins |
| regular super_admin role request | root |

`admin_role_request` may request staff→admin (validates course + position + scope on
approval). It can **never** grant super_admin.

## Audit

| Capability | staff | admin | super_admin |
|---|---|---|---|
| Full audit log | ⛔ | 🟡 limited course-level activity (if enabled & safe) | ✅ |
