import Link from "next/link";
import { ArrowLeft, Bot, Compass, Users } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { NetworkBackground } from "@/components/landing/NetworkBackground";
import { UserMenu } from "@/components/layout/UserMenu";
import type { SessionUser } from "@/lib/auth/session";

type Tile = {
  title: string;
  description: string;
  href: string;
  icon: typeof Bot;
};

const TILES: Tile[] = [
  {
    title: "בוט חניכה ומשוב",
    description: "התייעצות, ניסוח משוב, הכנה לשיחת חניכה וניתוח אירוע.",
    href: "/assistant",
    icon: Bot,
  },
  {
    title: "חניכים ותיקי חניך",
    description: "ניהול פרטי חניכים, חוזקות, פערים והערות חניכה.",
    href: "/trainees",
    icon: Users,
  },
];

/**
 * Standalone entry screen (rendered at `/`, outside the app shell — no sidebar).
 * Dark navy field with a subtle animated network background; brand mark stays in
 * the top-right (RTL inline-start), and two large fully-clickable tiles lead into
 * the app.
 */
export function LandingScreen({ user }: { user: SessionUser | null }) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100 focus:outline-none"
    >
      {/* Soft navy wash under the network */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
        aria-hidden="true"
      />
      <NetworkBackground />

      {/* Brand + auth — top-right in RTL (inline-start). z-20 so the auth control
          sits above the centered content overlay and stays clickable. */}
      <div className="absolute start-6 top-6 z-20 flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900">
            <Compass className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold text-white">{siteConfig.name}</span>
            <span className="text-xs text-slate-400">פיקוד וניהול הדרכה</span>
          </span>
        </div>
        {user ? (
          <UserMenu username={user.username} />
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            התחברות
          </Link>
        )}
      </div>

      {/* Centered content */}
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">מצפן</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
          מערכת חניכה ומשוב לסגל ההדרכה.
        </p>

        <div className="mt-12 grid w-full gap-6 sm:grid-cols-2">
          {TILES.map((tile) => {
            const Icon = tile.icon;
            return (
              <Link
                key={tile.href}
                href={tile.href}
                className="group flex min-h-[13rem] flex-col rounded-2xl border border-line bg-surface p-8 text-start shadow-xl transition-all hover:-translate-y-0.5 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <ArrowLeft
                    className="h-5 w-5 text-subtle transition-transform group-hover:-translate-x-1"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="mt-6 text-xl font-semibold text-ink">{tile.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{tile.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
