# מצפן — Security Test Matrix

Concrete, checkable cases for the threats in the spec (§29). Each row: the attack,
the expected server behavior, and where it is enforced. Re-verify the affected rows
after every phase. "404-not-403" means we never reveal whether an inaccessible
record exists.

---

## Authentication & session

| # | Case | Expected | Enforced in |
|---|---|---|---|
| A1 | Request protected route with no/expired cookie | 401 (API) / redirect `/login` (page) | `middleware.ts`, layout gates |
| A2 | Valid cookie for a deleted user | treated as logged-out | `getAccount()` phantom check |
| A3 | Role forged in the JWT | ignored — role read DB-fresh | `getAccount()` (role not in token) |
| A4 | Suspended/disabled user logs in | blocked with Hebrew notice | login route (`assertActive`) |
| A5 | Suspended mid-session | next request denied at every gate | grant constructors |

## Roles & root protection

| # | Case | Expected | Enforced in |
|---|---|---|---|
| R1 | Plain admin PATCHes a user to `super_admin` | 403 `root_required` | `policy.canChangeRole` + `requireRootSuperAdmin` |
| R2 | Regular super_admin promotes another to super_admin | 403 `root_required` | same |
| R3 | Any API demotes/suspends/disables/re-roles a root | 403 `root_protected` (first guard) | `policy.*`, `adminSetUserRole/Status` |
| R4 | Create a root via any website route | impossible — no such route exists | — (bootstrap script only) |
| R5 | Demote/suspend the last active manager | 409 `last_admin` | `adminSetUserRole/Status` count guard |
| R6 | Self-demote out of management role without confirm | 409 `self_needs_confirm` | `policy` + route |
| R7 | Body sends `role`/`isRootSuperAdmin` on signup/profile | ignored (server-derived; whitelist) | signup/profile routes |

## IDOR / cross-scope

| # | Case | Expected | Enforced in |
|---|---|---|---|
| I1 | Staff opens another staff's trainee by id in URL | 404 | `requireTraineeAccess` / `scopeFilter` (id+scope in one query) |
| I2 | Staff downloads another owner's attachment | 404 | `getAttachment` (attId+traineeId+owner+course) |
| I3 | Admin opens another course's trainee/user | 404 | course-scoped `AdminGrant.courseScope` |
| I4 | Swap `attId` to one under a different trainee | 404 | attachment query includes `traineeId` |
| I5 | Staff edits a trainee in a locked cohort | 403 / 404 | write filter `cohortLocked: {$ne:true}` |
| I6 | Message/thread accessed by a non-participant | 404 | participant check |

## Invites

| # | Case | Expected | Enforced in |
|---|---|---|---|
| V1 | Reuse an already-used invite | rejected `כבר נוצל` | atomic conditional consume |
| V2 | Two signups consume one invite concurrently | exactly one succeeds | conditional `updateOne` (status→used) |
| V3 | Expired / revoked invite | rejected with specific Hebrew error | server validation (re-checked at final signup) |
| V4 | Invite for course A used to sign up under course B | rejected / course locked to invite | server (course from invite, not client) |
| V5 | Invite plaintext appears in logs/response/URL after creation | never | shown once at creation only |
| V6 | Brute-force invite validation | throttled (simple attempt limit) | in-memory limiter |

## Mass assignment / input

| # | Case | Expected | Enforced in |
|---|---|---|---|
| M1 | Extra fields in trainee create/update body | ignored (whitelisted `TraineeInput`) | `parseTraineeBody`, data layer |
| M2 | Client sends `courseType`/`ownerId`/org ids on create | ignored — stamped from server scope | data layer |
| M3 | Invalid ObjectId in any id param | 404, no crash | `isValidObjectId` guards |
| M4 | Signup submits arbitrary cohort/team ids outside active options | rejected | server validates course→cohort→team relationships |

## Files / attachments

| # | Case | Expected | Enforced in |
|---|---|---|---|
| F1 | Path traversal via filename | N/A — buffers stored in Mongo, keyed by ObjectId | storage model |
| F2 | Oversized / disallowed MIME upload | rejected (size + allowlist) | upload guards |
| F3 | Message attachment fetched by non-participant | 403/404 | authorized attachment route |

## Directory / hidden accounts

| # | Case | Expected | Enforced in |
|---|---|---|---|
| D1 | Hidden project-owner appears in directory or recipient search | never | visibility filter on listing queries only |
| D2 | Hidden owner's actions anonymous in audit | never — always attributed | audit writes ignore visibility |
| D3 | Crown used to authorize | never — display-only from `isRootSuperAdmin` | UI only; authz separate |

## Secrets

| # | Case | Expected |
|---|---|---|
| S1 | Password hash in any response/log/DTO | never (positive projection allowlist) |
| S2 | Invite plaintext / JWT / cookie / env in logs | never |
| S3 | `.env.local`, `.local/` committed to git | never (gitignored) |
| S4 | `NEXT_PUBLIC_` secret introduced | never |

---

Verification method: unit truth-tables in `scripts/check-admin-guards.ts`
(pure, no DB) for R1–R7; end-to-end per-role manual testing with the credentials
from `npm run dev:seed-test-data` for the rest (see plan's Verification section).
