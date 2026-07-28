import Link from "next/link";
import { Compass } from "lucide-react";
import { siteConfig } from "@/lib/config";
import { NetworkBackground } from "@/components/landing/NetworkBackground";
import { UserMenu } from "@/components/layout/UserMenu";
import { SettingsButton } from "@/components/layout/SettingsButton";
import { NotificationBell } from "@/components/notifications/NotificationBell";

/**
 * Standalone entry screen (rendered at `/`, outside the app shell — no sidebar).
 * Dark navy field with the restored drifting white-point background animation
 * (behind the content, pointer-events-none, honors prefers-reduced-motion). One
 * primary action (§37): "כניסה למערכת" into the role-appropriate destination, or
 * "התחברות" for guests. Logged-in visitors also get the shared account controls
 * (bell + user card + settings gear).
 */
export function LandingScreen({
  username,
  destination,
}: {
  username: string | null;
  destination: string | null;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative min-h-dvh overflow-hidden bg-slate-950 text-slate-100 focus:outline-none"
    >
      {/* Soft navy wash + the drifting white-point animation (restored). */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950"
        aria-hidden="true"
      />
      <NetworkBackground />

      {/* Full-width top bar (§2), mirroring the app shell so the layout is identical
          everywhere. Right (inline-start): brand + account cluster (bell + user card).
          Left (inline-end): the settings gear, alone. z-20 above the animation. */}
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-4 px-6 py-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-base font-semibold text-white">{siteConfig.name}</span>
              <span className="text-xs text-slate-400">פיקוד וניהול הדרכה</span>
            </span>
          </div>
          {username ? (
            <div className="flex items-center gap-3 rounded-xl bg-surface/95 p-1.5 shadow-sm">
              <NotificationBell />
              <UserMenu username={username} />
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              התחברות
            </Link>
          )}
        </div>
        {username ? (
          <div className="rounded-xl bg-surface/95 p-1.5 shadow-sm">
            <SettingsButton />
          </div>
        ) : null}
      </div>

      {/* Centered content — above the animation. */}
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-2xl flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">מצפן</h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
          מערכת חניכה ומשוב לסגל ההדרכה.
        </p>
        <div className="mt-10">
          <Link
            href={destination ?? "/login"}
            className="inline-flex items-center rounded-lg bg-slate-100 px-6 py-3 text-base font-semibold text-slate-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-100 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            {destination ? "כניסה למערכת" : "התחברות"}
          </Link>
        </div>
      </div>
    </main>
  );
}
