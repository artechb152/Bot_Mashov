# מצפן — Matzpen

A coaching and feedback system for training staff. It helps staff manage trainees and their
files, and — later — connect to an AI assistant. It is a private, per-user tool: each staff
member sees and manages only their own trainees, within their own course.

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

No AI SDK is installed and no AI is wired up. The assistant is a UI-only chat.

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
    page.tsx             # Public landing page (outside the app shell)
    login/  signup/      # Auth screens
    select-course/       # One-time course choice for accounts predating courses
    (app)/               # Route group: sidebar + topbar shell, requires auth AND a course
      trainees/          # List, create, edit, profile (the trainee file)
      assistant/         # Bot — UI only, no AI
      knowledge/         # Redirects to /assistant (kept, but not user-facing)
    api/
      auth/              # signup, login, logout, course
      trainees/          # CRUD, attachments, import (preview + create)
  components/            # ui/ (primitives), layout/, auth/, course/, trainees/, assistant/
  lib/
    auth/                # session (JWT), password, current-user, require-scope
    course/              # courseConfig.ts — the per-course seam
    data/                # scope.ts + owner+course-scoped data access
    import/              # parse-trainee-file.ts — dependency-free extraction
    bot/                 # system prompt + assistant context (staged, not wired to any AI)
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

- The AI assistant integration (the chat is UI-only; nothing is sent anywhere or persisted)
- Rate limiting on login, and session revocation (the JWT is stateless, valid 7 days)

> The product name **מצפן** ("compass") is a working placeholder — change it in
> `src/lib/config.ts` to rename it everywhere.
