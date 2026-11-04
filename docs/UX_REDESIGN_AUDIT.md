# חונך+ — UX redesign audit (Issue #1)

Baseline inspected on 2026-11-03 against the running app (`http://localhost:3000`) with the
non-sensitive test accounts (`staff.kapeh.1.test`, `admin.kapeh.test`, `superadmin.test`) and
the synthetic `[הדגמה]` trainees only. Widths: 1600, 1440, 1280, 1024, 768, 390, 320.
Screenshots are kept locally in the git-ignored `.playwright-cli/` folder; a curated, safe
before/after set is in [`docs/ux-redesign/`](ux-redesign/).

Severity: **P0** = data loss / blocked task / accessibility failure · **P1** = core workflow
friction · **P2** = consistency / polish.

## Findings, fixes and verification

| # | Sev | Finding (evidence) | Fix | Verified |
|---|---|---|---|---|
| 1 | P0 | **Failed feedback save cleared the form.** `FeedbackComposer` awaited `onSubmit()` and always called `reset()`; `addFeedback()` returned `false` on failure (code). | Adopted PR #2 and extended it: `onSubmit` resolves to `SaveResult` (`{ok:true}` / `{ok:false,error}`); the form clears only on `ok:true`; any failure (HTTP error, network, thrown) keeps title, text and file and shows a focusable inline alert with retry. Same contract for the edit dialog and "save polish as feedback". | Playwright: forced 500 and `net::ERR_FAILED` on `POST /api/trainees/*/feedback` at 1440 and 390 → inline alert, all fields kept; then a real save cleared the form and added the row. |
| 2 | P0 | **Switching trainee discarded an unsaved draft.** The composer lived inside the expanded list row and unmounted on switch (code + runtime). | Drafts live in the workspace provider, in memory only, keyed by trainee; rows with a draft show "טיוטה"; leaving `/workspace` (link or reload) asks first; cohort links do not prompt. Not persisted to localStorage (privacy). | Playwright: draft → other trainee → marker shown → back → content intact; profile link → confirm dialog shown, dismiss keeps you on `/workspace`. |
| 3 | P0 | **Review squeezed to ~165px at 1024** (rail 300px + assistant 28%/19rem + sidebar 256px). Screenshot `before/sel_…_1024`. | New layout: rail 256–288px + fluid review; assistant is a column only from 1536px (review ≥600px), a drawer at 1024–1535px, and a pane on phones. | Screenshots at all 7 widths: review ≥512px at 1024, ~670px at 1600; no horizontal overflow at any width. |
| 4 | P0 | **People directory unreachable.** `AppShell` passed `onOpenDirectory`, `Sidebar` ignored it; no other trigger existed (code + runtime). | "אנשי המערכת" is a first-level sidebar item for every active user (server still scopes `/api/directory`). Flyout gained focus management (focus to search, Tab trap, Escape, focus return). | Playwright at 1440: opens, focus lands in search; on phones the drawer closes and the flyout opens. |
| 5 | P0 | **Unreadable tertiary text.** `--color-subtle #94a3b8` = 2.56:1 on white, used for dates, hints, counts, placeholders. Sidebar footer `slate-500` on `slate-900` = 3.75:1. Input borders `#cbd5e1` = 1.48:1. | `subtle → #5b6b80` (5.0:1 on surface-2), new `control #8592a6` for field borders (3:1), rail text `#b6c2d6` (7.9:1 on rail). | Contrast computed for every token pair (see DESIGN.md). |
| 6 | P0 | **Faint focus indicators.** Many controls used `ring-slate-900/15` (≈1.3:1) as their only focus style. | Single `focus` token (action blue); all controls use `ring-focus`; fields use `border-focus` + soft ring. | Keyboard sweep of `/workspace`: every stop showed a visible ring. |
| 7 | P1 | **Phone: floating menu button covered the "חניכים" heading**; workspace stacked list, review and assistant into one long page with nested scrollers. | Phone top bar on every route (menu · wordmark · updates); workspace switcher `חניכים · [שם] · עוזר AI`, one scroll container per zone. | 390/320 screenshots; selecting a trainee jumps to its zone. |
| 8 | P1 | **No search in the workspace trainee picker** (exists in `/trainees`). | Search by name/team, live result count (`aria-live`), no-result state with clear action, Escape clears. | Playwright: "א׳" → 1 of 3; "zzz" → no-result state. |
| 9 | P1 | **Feedback writing confined to a 300px rail**, with the whole form permanently expanded under a list row. | Trainee view has two tabs — "סקירה" (one review document) and "משובים" (composer, history, AI-source checkboxes, archive) — at full work-area width; one primary "משוב חדש" in the header. 8-row textarea, 16px text. | Screenshots 1440/390. |
| 10 | P1 | **Navigation split across patterns**: user menu in the sidebar footer *and* top bar; updates only in the top bar (absent on `/workspace`); management only inside the user menu. | One hierarchy in the rail: work (cohorts) → general (directory, updates with unread count, management for admin/super) → account (profile & settings, logout). No desktop top bar. | Rail checked for staff, admin and super-admin; role-gated item hidden for staff (server RBAC unchanged). |
| 11 | P1 | **Admin/system tables overflowed the page by 85–92px at 390** (`/admin/users`, `/system/users`). Cause: the absolutely-positioned `sr-only` header escaped the table's scroll container. | `Table` wrapper is `relative`; on phones secondary columns collapse into a sub-line under the name, and the name is the row link (no off-screen action column). | `overflowX=0` at 390 on all management routes. |
| 12 | P1 | **Mobile drawer stayed focusable when closed** (translated off-screen, no `inert`), no Escape, no focus trap. | Drawer is a labelled modal dialog: `inert` when closed, focus in on open, Tab trapped, Escape/backdrop close, focus returns. | Playwright at 390. |
| 13 | P1 | **Assistant UI**: header truncated to "עוז…" at 1280; composer buttons clipped; drag-resize handle and collapse state added complexity. | Assistant header shows trainee + source count; conversation select and "שיחה חדשה" on their own row; resize handle removed; busy state visible on the toggle (and on the phone tab). | Screenshots 1600/1280/390; mocked `not_configured` task shows the notice and busy marker. |
| 14 | P1 | **Dialog stole focus while typing** when a parent re-rendered (inline `onClose` in effect deps). | `onClose` read through a ref; the open effect depends on `open` only. | Code review (not separately reproduced in the browser). |
| 15 | P2 | Primary button was dark slate while brand tokens defined action blue; DESIGN.md and code disagreed. | `primary = brand-action #2E6BD6`, hover `#245BB8`; rail uses the brand navy; DESIGN.md rewritten to match the shipped tokens. | Visual check across routes. |
| 16 | P2 | 10–12px actionable labels (feedback "עריכה/ארכוב", "הפק סקירה מחדש", tags at 11px); 24–32px icon targets. | Actions ≥14px, buttons 40px (`sm`) / 44px phone (`md`), icon buttons 40px. | Screenshots. |
| 17 | P2 | Updates popover nested a bordered card inside the popover; red dot (danger) used for "unread"; two names ("התראות" vs "עדכונים"). | Flush list in the popover, action-blue unread dot + sr-only "לא נקרא", one term "עדכונים", "לכל העדכונים" link. | Screenshot 1440. |
| 18 | P2 | README claimed "no AI is wired up" and described removed routes. | README updated: AI provider abstraction, env vars, current routes. | — |
| 19 | P2 | Two skip links once the shell added its own. | Kept the root-layout skip link only. | Keyboard sweep. |

## Decisions and deviations

- **Breakpoints**: the assistant column starts at 1536px (Tailwind `2xl`) because below that a
  third column pushes the review under ~560px with the 256px rail. 1024–1535px uses a drawer.
- **Assistant drawer is non-modal**: it overlays the review's inline-end edge with no
  backdrop; the review remains interactive. Opening moves focus to the assistant input,
  Escape closes when focus is inside it, and focus returns to the trigger. Tab is **not**
  trapped; do not represent the drawer as an aria-modal dialog.
- **Back/forward**: trainee selection still uses `history.replaceState` (no history entry per
  trainee click). While feedback drafts exist the guard keeps a same-URL entry on top of a
  marked base entry. Only landing on the base entry (Back out of the work area) prompts;
  cancel reinstates the guard and re-syncs the URL to the selected trainee, accept steps
  past it. Back between in-workspace entries (cohort links) does not prompt. A confirmed
  link exit and a successful save/discard both step off the guard first, so one Back is
  enough afterwards. It is **not** a blocker for arbitrary programmatic `router.push`.
- **Drafts are memory-only**: they survive trainee/tab/cohort switches but not a full reload,
  by design (no personal trainee content in localStorage without a privacy decision).
- **Archiving a cohort** from the rail now asks for confirmation (reversible, but easy to hit).
- No RBAC, API, model, AI-provider or data changes. No DB writes beyond one synthetic test
  feedback on a `[הדגמה]` trainee, created and archived during the smoke test.

## Deferred / known limitations

- `next build` was run in an isolated worktree (see PR) rather than against the live dev
  server's `.next`, per `docs/CURRENT_WORK_STATE.md`.
- No real AI call was made during QA (to avoid spending provider credits); the AI paths were
  exercised with the empty state and a mocked `not_configured` response.
- `/messages`, `/requests` and `/knowledge` routes exist but are not in the navigation (an
  earlier product decision); they were not redesigned.
- `/settings/*` keeps its own minimal layout outside the rail shell.
- Cross-browser (Safari/Firefox) and real-device checks remain for manual acceptance.

## PR #3 follow-up review (2026-11-04)

The code review found previously untested context-isolation and navigation issues.
The follow-up implementation includes: per-trainee in-memory assistant sessions (input,
polish results, note and save dialog), origin-bound asynchronous polish responses,
origin-specific feedback form cleanup after delayed save, keyed feedback-edit panels on
trainee changes, and a same-URL browser-Back draft guard. The assistant drawer is now
explicitly non-modal.

### §32 verification against the running app (2026-11-04)

Chromium via Playwright, `staff.kapeh.1.test`, the three `[הדגמה]` trainees only, at 1280
(drawer), 1600 (column) and 390 (phone). `POST /api/ai/tasks/feedback_polish` was answered
by an in-browser mock with a controllable delay, every other AI POST was stubbed, feedback
create was mocked (delayable) and feedback edit returned 500 — **no real AI call and no
database write**. An editable entry was injected into one trainee's feedback list response.

Found and fixed while running §32:

| # | Finding | Fix |
|---|---|---|
| R1 | The incoming follow-up did not compile: a JSX comment as the first child of a ternary branch in `TraineeWorkPanel` (TS1005), and a lost narrowing in `AssistantPanel` (TS2339). `/workspace` could not render. | Plain `//` comment; read the message before the closure. |
| R2 | Back-cancel after switching trainee left the URL on the trainee that was selected when the guard was added (the base entry predates the `replaceState` sync). | The guard calls the provider's `syncUrl` after cancel and after stepping off on save. |
| R3 | Any popstate prompted — including Back from a cohort link inside `/workspace`, which does not leave the work area. | The entry under the guard is marked; only reaching it prompts. |
| R4 | After a confirmed link exit, Back returned to the stale guard entry and needed a second Back to leave. | A confirmed exit steps off the guard (`history.back()`), then `router.push`es the target. |
| R5 | Escape never closed the assistant drawer: the closed phone navigation drawer is always mounted with `aria-modal="true"`, so the "a modal owns Escape" check always matched. | Ignore `[inert]` dialogs. |
| R6 | Returning to trainee A re-opened A's "save as feedback" modal over the view (on phones, over a different pane). | The dialog closes on any trainee switch and stays closed; the polish result remains in A's session. |
| R7 | A late polish result/error for A cleared B's busy state or raised a banner over B. | Token-checked like the other provider actions. |

Run with the incoming follow-up hook, R2–R4 reproduce (43/46 checks). After the fixes: 46/46
at 1280, 39/39 at 1600 and 39/39 at 390 (the drawer checks apply only at 1024–1535). Reload
or tab close with a draft raises the browser's `beforeunload` prompt. Not covered: Alt+Left as
a real key chord (identical to `history.back()` in automation), Safari/Firefox, real devices,
and switching between two real cohorts (the test account has one; the in-workspace Back case
was exercised with a cohort-link entry instead).

### §32 follow-up: asynchronous conversation actions (R8)

Second review round: the assistant's conversation actions could still write A's result into
B's view.

| # | Finding | Fix |
|---|---|---|
| R8 | `ensureConversation`, `startNewConversation`, `toggleSource` and `sendChat` wrote conversation state, turns and notices after an `await` without checking the trainee. `sendChat` also captured its token *after* awaiting `ensureConversation`, so for a switch during creation the token was B's: A's reply was appended to B's turns and B was left in a "sending" state that nothing cleared. Late failures of `sendChat`, `runTask`, `toggleSource` and creation raised A's error banner over B. | The token is captured before the first `await` and every later state write, loading flag and error banner is gated on it. After a switch the server call for the original trainee still completes (a first message is still delivered to A's new conversation, a source toggle still reaches A's conversation), but the visible state belongs to B and is not touched. |

Verification (Playwright, mocked `/api/ai/**` with controllable delays, demo trainees only, no
real AI call, no database write): create delayed then switch; first send with delayed create
and delayed reply; late create/message/task failures; source toggle that must create the
conversation first, and one that only updates it. 30/30 at 1280, 1600 and 390. Against the
previous provider code the same script fails 9 of 30. The §32 suite still passes (46/46,
39/39, 39/39). Remaining limitation: if the user returns to A while A's creation is still
pending, A's reload may not list the new conversation until the next reload.

