# CLAUDE.md — מצפן (Matzpen)

Hebrew, RTL command & training-management system for course staff. Next.js 15 (App Router),
React 19, TypeScript strict, Tailwind CSS v4 (CSS-first tokens in `src/app/globals.css`),
MongoDB/Mongoose, custom JWT auth, Heebo font, lucide-react icons. No shadcn/ui, no Radix,
no animation library.

- Product overview and stack: [README.md](README.md)
- **Visual language — source of truth: [DESIGN.md](DESIGN.md)** (restrained, monochrome slate,
  operational tool; no emoji, gradients, heavy shadows, decorative badges or showy animation;
  logical properties for RTL; 40px+ hit targets).
- Authorization is server-side only — see [docs/RBAC_MATRIX.md](docs/RBAC_MATRIX.md).
- Validation: `npm run typecheck`, `npm run lint`, `npm run build`, and the `check:*` scripts.
- Dev server: keep it running at http://localhost:3000 (`npx next dev -p 3000`).

---

## AUTONOMOUS DESIGN SKILL ORCHESTRATION

Standing policy. Pick and invoke the right project skills (`.claude/skills/`) yourself, at the
stage where they add the most value — the user should never have to name a skill. Do not load
every skill on every task: choose the smallest effective set, and skip design skills entirely
for backend-only work. Full inventory, sources and limits: [docs/DESIGN_SKILLS_SETUP.md](docs/DESIGN_SKILLS_SETUP.md).

### Stage → skills

| Stage | Use | Notes |
|---|---|---|
| Starting any design task | `impeccable` (shape), `ui-ux-pro-max` | First identify goal, audience (training staff), function, and the DESIGN.md language. |
| Changing an existing screen | `impeccable` (critique/audit) **before** significant edits; `web-design-guidelines` | Short critique first, then change. |
| New UI components / pages | `frontend-ui-engineering`, `frontend-design`, `vercel-composition-patterns` | Build from existing tokens/components in DESIGN.md; no new visual system. |
| React / Next.js code | `vercel-react-best-practices` | Server Components, data fetching, bundle size. |
| Animation / motion | `animate` (build), `emil-design-eng`, `animation-performance`, `find-animation-opportunities` / `improve-animations` (read-only audits) | DESIGN.md: motion only when it explains a state change. Respect `prefers-reduced-motion`. |
| User flows | `signup` (registration), `onboarding` (first-run, empty states), `copywriting` (UI copy, Hebrew), `cro` (forms) | Adapt marketing advice to an internal tool — clarity over persuasion. |
| Mobile behaviour | `mobile-native`, `responsive-craft` | Staff use phones; check 100vh, input zoom, safe areas. |
| Edge cases | `break-ui` | Long Hebrew names, empty lists, huge counts, mixed RTL/LTR text. |
| After a significant visual change | `playwright-cli` | See "Browser verification" below. |
| Before finishing frontend work | `accessibility`, `web-quality-audit` (+ `performance` / `core-web-vitals` / `best-practices` as relevant), `impeccable` detector | Scope the audit to what changed. |
| Art-direction exploration | `design-taste-frontend` (app-screen mode), `frontend-design` | Only when the user asks for a new direction; never to override DESIGN.md. |

Situational, only when the stack calls for it: `shadcn` (only if shadcn/ui is adopted — it is
not today), `ai-elements` (AI chat UI; see limits), `seo` (public pages only — the app is
private), `design-system` / `design-audit` / `design-review` / `front-a11y` /
`bencium-innovative-ux-designer` (older overlapping skills — prefer the primary ones above).

### Conflict priority

When skills disagree, resolve in this order:

1. The user's explicit requirements and this project's requirements.
2. Functionality, security (server-side auth), and accessibility.
3. The approved design system — DESIGN.md and decisions already confirmed.
4. Recommendations of the skill that fits the task.
5. General aesthetic preferences.

No skill may change the product's identity. Skills that push "bold aesthetic risk", brand
colour, gradients, display typography or showy motion (`frontend-design`,
`design-taste-frontend`, `bencium-innovative-ux-designer`, `impeccable` bolder/delight/overdrive)
yield to DESIGN.md's restrained, operational look unless the user asks for a new direction.

### Browser verification

After a significant visual change, check the real app with `playwright-cli` against
http://localhost:3000: desktop (1440) and mobile (390) widths, RTL rendering, the changed
interactions, scrolling, and loading / empty / error states. Use a named session
(`playwright-cli -s=<name> ...`) and `close` it when done. Output goes to the gitignored
`.playwright-cli/`. This is visual verification only — do not add committed E2E test suites
unless asked. The user still does their own manual acceptance testing
([docs/MANUAL_ACCEPTANCE_TESTS.md](docs/MANUAL_ACCEPTANCE_TESTS.md)).

### Automation limits

- **Impeccable hook** (project-local, `.claude/settings.local.json`): after each Edit/Write on a
  UI file it injects mechanical detector findings, and runs a deep pass on Stop. Treat findings
  per `.claude/skills/impeccable/reference/hooks.md` — fix real problems; never add a broad ignore
  without asking. Toggle: `.claude/skills/impeccable/scripts/impeccable hooks on|off`.
- **`review-animations` is manual-only** (`disable-model-invocation: true`). Do not invoke it or
  imitate it by reading its file. For automatic motion review use `emil-design-eng` +
  `animation-performance`, or `improve-animations` for a codebase audit, and suggest the user run
  `/review-animations` when a full review is warranted.
- **`ai-elements` / `shadcn`**: guidance only. Running `npx ai-elements` or `npx shadcn` would
  initialise shadcn/ui and add dependencies — get the user's approval first and add only the
  components actually needed.
- **`design-taste-frontend`** scripts spawn a local Chrome and download images from public-domain
  APIs; use them only on explicit request and check image licences.
- **`ui-ux-pro-max`** script: run from the project root as
  `python -I .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain <domain>`
  (its SKILL.md prefixes `${CLAUDE_PLUGIN_ROOT}`, which is unset for project skills).
- Skill discovery is automatic from each skill's `description`; nothing here forces a skill to
  load. If a needed skill does not fire, invoke it explicitly with the Skill tool.
