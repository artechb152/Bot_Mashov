# מצפן — Design Skills Setup

Installed 2026-11-03. Skills that Claude Code uses for UI, UX, frontend engineering, motion and
quality work in this project. How Claude chooses between them is defined in
[CLAUDE.md](../CLAUDE.md) → *AUTONOMOUS DESIGN SKILL ORCHESTRATION*.

All skills are **project-level**, in `.claude/skills/<name>/SKILL.md`, committed with the repo.
Nothing was installed as a global Claude skill or plugin.

## Inventory

**Invocation:** *auto* = Claude loads the skill on its own when the task matches its
description; *manual* = only the user can run it (`/<name>`); *model-only* = Claude can load it,
but it is hidden from the `/` menu.

### Visual design & art direction

| Skill | Source | Installed with | Invocation |
|---|---|---|---|
| `impeccable` (v4.8.0) | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) | `npx impeccable install --providers=claude --scope=project` | auto + `/impeccable <command>`; design hook |
| `frontend-design` | [anthropics/skills](https://github.com/anthropics/skills) | `npx skills add` | auto |
| `ui-ux-pro-max` | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `npx skills add` | auto |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | `npx skills add` | auto |

### Frontend engineering

| Skill | Source | Installed with | Invocation |
|---|---|---|---|
| `frontend-ui-engineering` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | `npx skills add` | auto |
| `web-design-guidelines` | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | `npx skills add` | auto |
| `vercel-react-best-practices` | vercel-labs/agent-skills | `npx skills add` | auto |
| `vercel-composition-patterns` | vercel-labs/agent-skills | `npx skills add` | auto |

### Motion & interaction

| Skill | Source | Installed with | Invocation |
|---|---|---|---|
| `emil-design-eng` | [emilkowalski/skills](https://github.com/emilkowalski/skills) | `npx skills add` | auto |
| `animate` | emilkowalski/skills | `npx skills add` | auto |
| `review-animations` | emilkowalski/skills | `npx skills add` | **manual** (`disable-model-invocation: true`) |
| `improve-animations` | emilkowalski/skills | `npx skills add` | auto (read-only audit) |
| `find-animation-opportunities` | emilkowalski/skills | `npx skills add` | auto (read-only) |
| `animation-performance` | emilkowalski/skills | `npx skills add` | auto |
| `break-ui` | emilkowalski/skills | `npx skills add` | auto |
| `mobile-native` | emilkowalski/skills | `npx skills add` | auto — added beyond the requested list, because staff use the app on phones |

### Browser testing & quality

| Skill | Source | Installed with | Invocation |
|---|---|---|---|
| `playwright-cli` (CLI v0.1.23) | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) | `npm i -g @playwright/cli@latest` + `playwright-cli install --skills` | auto |
| `web-quality-audit` | [addyosmani/web-quality-skills](https://github.com/addyosmani/web-quality-skills) | `npx skills add` | auto |
| `performance` | addyosmani/web-quality-skills | `npx skills add` | auto |
| `core-web-vitals` | addyosmani/web-quality-skills | `npx skills add` | auto |
| `accessibility` | addyosmani/web-quality-skills | `npx skills add` | auto |
| `seo` | addyosmani/web-quality-skills | `npx skills add` | auto (low relevance: the app is private) |
| `best-practices` | addyosmani/web-quality-skills | `npx skills add` | auto |

### Design systems & product UX

| Skill | Source | Installed with | Invocation |
|---|---|---|---|
| `shadcn` | [shadcn-ui/ui](https://github.com/shadcn-ui/ui/tree/main/skills/shadcn) | `npx skills add shadcn/ui` | model-only (`user-invocable: false`) |
| `cro` | [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) | `npx skills add` | auto |
| `copywriting` | coreyhaines31/marketingskills | `npx skills add` | auto |
| `signup` | coreyhaines31/marketingskills | `npx skills add` | auto |
| `onboarding` | coreyhaines31/marketingskills | `npx skills add` | auto |
| `ai-elements` | [vercel/ai-elements](https://github.com/vercel/ai-elements) | `npx skills add` (skill only) | auto |

### Already in the project before this setup (kept)

`bencium-innovative-ux-designer`, `design-audit`, `design-review`, `design-system`,
`front-a11y`, `responsive-craft`. Their sources were not recorded and they are not in
`skills-lock.json`. Four skills that were already here were **upgraded** to the official
current versions: `impeccable` (3.9.1 → 4.8.0), `frontend-design`, `ui-ux-pro-max`,
`web-design-guidelines`.

**Removed:** the third-party `shadcn-ui` skill. The official `shadcn` skill replaces it, and the
old one depended on a `tailwind-theme-builder` skill that was never installed. It is recoverable
from git history.

## Files outside `.claude/skills/`

| Path | What | Tracked |
|---|---|---|
| `skills-lock.json` | Sources and hashes of every `npx skills` install | yes |
| `.claude/agents/impeccable-*.md` | 4 subagents that Impeccable's build/finish flows use | yes |
| `.claude/settings.local.json` | Impeccable design-hook wiring (SessionStart, PostToolUse Edit\|Write, Stop) | no (per developer) |
| `.claude/skills/impeccable/scripts/bin/windows-x64/impeccable.exe` | Detector engine v0.1.18; SHA-256 matches `engine-checksums.txt` | yes |
| `.gitignore` | Adds `.playwright-cli/`, `.claude/settings.local.json`, `.impeccable/config.local.json`, `.impeccable/hook.cache.json` | yes |
| `~/AppData/Roaming/npm` | Global `@playwright/cli` | n/a |

## Automation and limits

- **Discovery.** Claude Code reads every skill's `description` at session start and loads a skill
  when a task matches. That is the only supported auto-invocation mechanism, and nothing
  guarantees that a given skill fires. CLAUDE.md therefore maps work stages to skills
  explicitly, so Claude invokes the right ones on purpose.
- **Impeccable design hook.** Runs a mechanical detector after edits to UI files
  (`.tsx/.jsx/.css/...`) and a full pass when a turn ends. It never blocks an edit. It runs
  unsandboxed with the agent's environment. To toggle it:
  `.claude/skills/impeccable/scripts/impeccable hooks on|off|status`. To fine-tune it, use
  `.impeccable/config.json`; it is created on first change and is shared.
  Because the hook lives in `settings.local.json`, other clones need to run
  `npx impeccable install --providers=claude --scope=project` (or `impeccable hooks on`) to get it.
  TSX scans are pattern-only. For contrast and size rules, scan the running app:
  `.claude/skills/impeccable/scripts/impeccable detect http://localhost:3000/...`.
- **`review-animations`** can only be run by the user. Claude uses `emil-design-eng`,
  `animation-performance` or `improve-animations` instead and does not work around the
  restriction.
- **`ai-elements`.** The skill is installed, but **no components were added**. AI Elements is a
  shadcn/ui registry built for the Vercel AI SDK. This project uses neither; its assistant uses
  the `openai` SDK directly with Tailwind v4 tokens. Adopting it would mean initialising
  shadcn/ui (`components.json`, `cn()`, CSS variables) and adding `ai`/`@ai-sdk/react`. That is a
  user decision. If approved, add only the components that are needed (e.g. `conversation`,
  `message`, `prompt-input`).
- **`shadcn`** is inactive until the project adopts shadcn/ui. No `components.json` exists.
- **`design-taste-frontend`** was flagged "Critical Risk" by one automated scanner (Gen). Socket
  reported 0 alerts and Snyk rated it Medium. Manual review found that its scripts spawn a local
  Chrome for screenshots and download images from public-domain APIs (Openverse, Wikimedia,
  Met, NASA, archive.org, picsum). They only write to their output folder and
  `~/.taste-skill/history.json`, and they read no secrets. The skill was kept; its scripts are run
  only on explicit request. Its marketing-site mode conflicts with DESIGN.md, so its
  app-screen mode is the relevant one here.
- **`ui-ux-pro-max`** script path: its SKILL.md uses `${CLAUDE_PLUGIN_ROOT}`, which is unset for
  project skills. Run it from the repo root:
  `python -I .claude/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux`.
- **Marketing skills** (`cro`, `signup`, `onboarding`, `copywriting`) are written for
  conversion-focused SaaS. For this internal tool, they are used for clarity, friction and
  empty-state guidance, not persuasion.

## Verification (2026-11-03)

- All 35 skill folders contain a `SKILL.md` with valid frontmatter, and each `name` matches its
  folder. No duplicate names.
- The live Claude Code session picked up the new skills without a restart: they appeared in the
  available-skills list right after installation.
- Impeccable: `hooks status` → enabled; the detector ran on `src/app/login/page.tsx`; the hook
  command exits 0 under Git Bash; the engine checksum matches.
- Playwright CLI: opened http://localhost:3000/login in Chrome and captured screenshots at 1440×900
  and 390×844; RTL rendered correctly. The only console error was an existing
  `/favicon.ico` 404.
- `ui-ux-pro-max` search script (Python 3.14) and `design-taste-frontend` lint script (Node 26)
  both ran.
- Environment: Node v26.3.0, npm 11.16.0, Python 3.14.6, Git 2.54, Chrome present.

## Updating

```bash
npx skills update -p -y                   # every skill in skills-lock.json
npx skills experimental_install           # restore skills from skills-lock.json on a fresh clone
npx impeccable update                     # Impeccable skill, engine, agents and hook
npm i -g @playwright/cli@latest && playwright-cli install --skills
```

After updating, re-check that `review-animations` and other skills keep their invocation flags,
and that `.claude/skills/ui-ux-pro-max` still has no `design-system` sibling. The repo's own
`design-system` skill would collide with it, so it was deliberately not installed.

To add a skill: `npx skills add <owner/repo> --skill <name> -a claude-code --copy -y`. Check
for name collisions with `ls .claude/skills` first.
