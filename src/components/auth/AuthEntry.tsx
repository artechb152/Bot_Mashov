"use client";

import { useState } from "react";
import { BrandWordmark } from "@/components/brand/BrandWordmark";
import { NetworkBackground } from "@/components/landing/NetworkBackground";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";

/**
 * The single, self-contained entry page rendered at `/` for guests (no session).
 * There is NO landing screen and NO auth modal: the login/signup card is a permanent
 * part of the page. Two balanced zones on desktop — the חונך+ brand + slogan on the
 * inline-start (right, RTL) and the form card on the inline-end (left) — over the
 * deep-navy field with the drifting network/particle background. On mobile it collapses
 * to a single centered card with the wordmark above it. RTL. The login↔signup switch is
 * an in-place mode toggle (no navigation, no popup), centered under the card.
 */
export function AuthEntry({
  initialMode = "login",
  next,
}: {
  initialMode?: "login" | "signup";
  next?: string;
}) {
  const [mode, setMode] = useState<"login" | "signup">(initialMode);
  const isLogin = mode === "login";

  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-brand-navy-deep px-4 py-12 text-slate-100 focus:outline-none"
    >
      {/* Soft depth + the drifting network background (behind the content). */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-navy-deep via-brand-primary/20 to-brand-navy-deep"
        aria-hidden="true"
      />
      <NetworkBackground />

      <div className="relative z-10 grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Brand zone — inline-start (right). Slogan/description on desktop. */}
        <div className="text-center lg:text-start">
          <BrandWordmark tone="onDark" size="xl" />
          <p className="mt-6 text-lg font-medium text-slate-100 sm:text-xl">
            עובדים חכם יותר. חונכים טוב יותר.
          </p>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300 sm:text-base lg:mx-0">
            כלי חכם לחניכה, משוב, סיכום ומעקב אחר התקדמות החניכים.
          </p>
        </div>

        {/* Form zone — inline-end (left). */}
        <div className="mx-auto w-full max-w-md lg:mx-0 lg:ms-auto">
          <div className="rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl sm:p-8">
            <h1 className="text-2xl font-semibold text-ink">{isLogin ? "התחברות" : "הרשמה"}</h1>
            <p className="mt-1.5 text-sm text-muted">
              {isLogin ? "התחברו עם שם המשתמש והסיסמה שלכם." : "יצירת חשבון סגל חדש."}
            </p>
            <div className="mt-6">{isLogin ? <LoginForm next={next} /> : <SignupForm />}</div>
          </div>

          {/* Centered switch — always in the same spot under the card. */}
          <p className="mt-5 text-center text-sm text-slate-300">
            {isLogin ? (
              <>
                אין לך חשבון?{" "}
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="font-semibold text-white underline underline-offset-2 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  להרשמה
                </button>
              </>
            ) : (
              <>
                כבר יש לך חשבון?{" "}
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="font-semibold text-white underline underline-offset-2 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  להתחברות
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  );
}
