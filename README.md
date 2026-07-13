# מצפן — Matzpen

A coaching and feedback system for training staff. It helps staff manage trainees and their
files, and — later — connect to an AI assistant. It is a private, per-user tool: each staff
member sees and manages only their own trainees.

The UI is **Hebrew, right-to-left (RTL)**, with a deliberately serious and restrained visual design.

## Tech stack

- **Next.js (App Router)** + **TypeScript**
- **Tailwind CSS v4** (CSS-first theme configuration)
- **MongoDB** via **Mongoose** — _scaffolded but not connected yet_
- **Heebo** Hebrew web font via `next/font`
- **lucide-react** icons

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the landing page — and continue to `/dashboard` for the app shell.

Useful scripts:

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run typecheck` — TypeScript check with no emit

## Project structure

```
src/
  app/
    layout.tsx           # Root layout: <html lang="he" dir="rtl">, font + globals
    page.tsx             # Public landing page (standalone, no app shell)
    globals.css          # Tailwind import + theme (font, base styles)
    (app)/               # Route group that shares the authenticated-style app shell
      layout.tsx         # Sidebar + topbar shell (URL is unaffected by the group)
      dashboard/
      trainees/
      feedback/
      simulations/
      roles/
      final-exercise/
      assistant/
      knowledge-base/
  components/
    layout/              # AppShell, Sidebar, Topbar
    PagePlaceholder.tsx  # Shared "module in progress" placeholder
  lib/
    config.ts            # Product name / description (single source of truth)
    navigation.ts        # Sidebar navigation items (label, href, icon, description)
    db/
      mongoose.ts        # Cached Mongoose connection helper (NOT called anywhere yet)
  models/                # Mongoose schemas will live here
```

## RTL & Hebrew typography

- `dir="rtl"` and `lang="he"` are set on `<html>` in `src/app/layout.tsx`.
- Layout uses **logical** Tailwind utilities (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`,
  `end-*`, `border-s/e`) so spacing and borders follow the writing direction automatically.
- The Hebrew font (Heebo) is loaded with `next/font` and exposed as the `--font-heebo`
  CSS variable, wired into Tailwind's `--font-sans` in `globals.css`.

## Database (not connected yet)

`src/lib/db/mongoose.ts` contains the standard cached-connection helper for Next.js, but
**it is intentionally never called** at this stage. When you are ready to connect:

1. Copy `.env.example` to `.env.local` and set `MONGODB_URI`.
2. Add schemas under `src/models/`.
3. Call `connectToDatabase()` from your data-access code / server actions / route handlers.

## Not included yet

- Authentication / authorization
- Real data and persistence
- The AI assistant integration

> The product name **מצפן** ("compass") is a working placeholder — change it in
> `src/lib/config.ts` to rename it everywhere.
