# חונך+ (codename Matzpen)

A coaching and feedback system for training staff. Staff manage trainees, record feedback,
and work with an AI assistant that drafts reviews and feedback from the feedback they select.
Each staff member sees and manages only their own trainees, within their own course; managers
get role-scoped management screens.

The UI is **Hebrew, right-to-left (RTL)**, with a deliberately serious and restrained visual
design (see [DESIGN.md](DESIGN.md), which is the source of truth for the visual language).

## Courses

The product serves two courses — **קפ"ה** (`kapeh`) and **מק"סים** (`maksim`). A staff user
belongs to exactly one, chosen at signup, and everything they see is scoped to it.

Authorization is enforced **server-side, never on the client**. Every trainee and document
query filters on the pair `{ ownerId, courseType }`, both derived from the session (see
`src/lib/data/scope.ts`). An id belonging to another user — or to the other course — simply
does not match and returns 404.

> Course-specific bot behaviour is not defined yet. `src/lib/course/courseConfig.ts` is the
> single seam where it will live, so it never gets scattered across components.

## Tech stack

- **Next.js 15 (App Router)** + **TypeScript** (strict)
- **Tailwind CSS v4** — CSS-first theme, configured in `src/app/globals.css` (no config file)
- **MongoDB** via **Mongoose** — cached connection helper in `src/lib/db/mongoose.ts`
- **Auth** — custom stateless JWT (`jose`) in an httpOnly cookie, `bcryptjs` password hashing
- **Heebo** Hebrew web font via `next/font`, **lucide-react** icons

- **AI** — a provider abstraction in `src/lib/ai/` (OpenAI, Gemini, a development-only Mock,
  and a Null provider when nothing is configured), selected by `AI_PROVIDER`. AI output is a
  draft for staff to review; the server re-derives which feedback enters the context, so the
  client can never widen it.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in MONGODB_URI and SESSION_SECRET
npm run dev
```

Open http://localhost:3000, then sign up at `/signup`.

### Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check, no emit |
| `npm run lint` | ESLint |
| `npm run knowledge:sync` | Mirror `knowledge/*.md` metadata into MongoDB (non-destructive) |
| `npx tsx scripts/check-import-parser.ts` | Smoke-check the trainee-import parser (no DB needed) |
| `npm run seed` | ⚠️ **DESTRUCTIVE — see below** |

> ### ⚠️ `npm run seed` deletes data
>
> The seed script **wipes seven collections** — including `User` and `Trainee` — before
> inserting demo records. On a database with real signups and real trainee files, running it
> destroys them.
>
> It is guarded: it refuses to run unless you opt in explicitly with
> `SEED_CONFIRM=yes npm run seed`. Do not set that variable on a database you care about.

## Environment

| Variable | Used by |
|---|---|
| `MONGODB_URI` | `src/lib/db/mongoose.ts` and the scripts. Read at call time — the app boots without it. |
| `SESSION_SECRET` | `src/lib/auth/session.ts` — signs the session JWT (HS256). Any long random string. |
| `AI_PROVIDER` | `src/lib/ai/index.ts` — `openai`, `gemini` or `mock` (development only). Empty → AI shown as not connected. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` / `GEMINI_API_KEY`, `GEMINI_MODEL` | Server-only provider credentials. Never exposed to the client. |

The local database is assumed to be a **standalone** MongoDB, so multi-document transactions
are **not** available. Multi-write flows (the course backfill, the file import) are therefore
written to be sequential, idempotent and retry-safe, with a compensating rollback where a
second write can fail.

## Project structure

```
knowledge/               # Bot source documents (internal — not a user-facing module)
scripts/
  seed.ts                # ⚠️ destructive demo seed (guarded by SEED_CONFIRM)
  sync-knowledge.ts      # knowledge/*.md → MongoDB metadata index
  check-import-parser.ts # pure-function checks for the import parser
src/
  app/
    layout.tsx           # Root: <html lang="he" dir="rtl">, Heebo, skip-link
    page.tsx             # Entry: signed in → /workspace, guest → login/signup
    select-course/       # One-time course choice for accounts predating courses
    settings/            # Profile & security
    (app)/               # Route group: navigation rail shell, requires auth AND a course
      workspace/         # The work area: trainee rail, review, feedback, AI assistant
      trainees/          # List, create, edit, profile (the trainee file)
      admin/  system/    # Role-scoped management (admin / super-admin)
      notifications/     # System updates
      assistant/         # Redirects to /workspace (kept for old links)
    api/
      auth/              # signup, login, logout, course
      trainees/          # CRUD, attachments, import, feedback, AI insights
      feedback/  ai/     # feedback edit/archive; conversations and AI tasks
  components/            # ui/ (primitives), layout/, workspace/, feedback/, auth/, …
  lib/
    ai/                  # provider abstraction, context building, schemas
    auth/                # session (JWT), password, policies, access checks
    course/              # courseConfig.ts — the per-course seam
    data/                # scope.ts + scoped data access
    hooks/               # client hooks (focus management, unsaved-changes guard, …)
    import/              # parse-trainee-file.ts — dependency-free extraction
  models/                # Mongoose schemas
  middleware.ts          # Edge session guard
```

## Trainees

Two ways to create one:

1. **Manually** — `/trainees/new`.
2. **From a file** — "הוספת חניך מקובץ". The file is read on the server, the extracted fields
   open in an **editable review form**, and the trainee is created only after confirmation,
   with the original file attached to it.

Extraction is deliberately simple and has **no dependencies and no AI**: `.txt`, `.md`, `.csv`
and `.json` are parsed; PDF/DOCX are attached but yield empty fields plus a warning telling the
user to fill the form in by hand. Guessing badly is worse than not guessing.

## RTL & Hebrew typography

- `dir="rtl"` and `lang="he"` are set on `<html>` in `src/app/layout.tsx`.
- Layout uses **logical** Tailwind utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`,
  `end-*`, `border-s/e`) so spacing and borders follow the writing direction automatically.
- Heebo is loaded with `next/font`, exposed as `--font-heebo`, and wired into Tailwind's
  `--font-sans` in `globals.css`.

## Not included yet

- Rate limiting on login, and session revocation (the JWT is stateless, valid 7 days).

> The product is presented as **חונך+**; "מצפן" (Matzpen) remains the repository codename.
> The textual name lives in `src/lib/config.ts`; the visual mark is `BrandWordmark`.
