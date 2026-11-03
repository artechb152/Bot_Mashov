import { BrandWordmark } from "@/components/brand/BrandWordmark";

/**
 * Shared shell for the auth pages (login / signup / select-course): a deep-navy field
 * matching the landing, composed as two balanced zones on desktop — the חונך+ brand
 * (wordmark + slogan) on the inline-start (right, RTL) and the form card on the
 * inline-end (left). On mobile it collapses to a single centered card with the
 * wordmark above it. RTL. Auth logic lives entirely in the injected `children`.
 */
export function AuthScreen({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <main
      id="main"
      tabIndex={-1}
      className="relative flex min-h-dvh items-center justify-center bg-brand-navy-deep px-4 py-12 text-slate-100 focus:outline-none"
    >
      <div className="grid w-full max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Brand zone — inline-start (right). Slogan/description only on desktop. */}
        <div className="text-center lg:text-start">
          <BrandWordmark tone="onDark" size="lg" />
          <p className="mt-5 hidden text-lg font-medium text-slate-100 lg:block">
            עובדים חכם יותר. חונכים טוב יותר.
          </p>
          <p className="mt-2 hidden max-w-sm text-sm leading-relaxed text-slate-300 lg:block">
            כלי חכם לחניכה, משוב, סיכום ומעקב אחר התקדמות החניכים.
          </p>
        </div>

        {/* Form zone — inline-end (left). */}
        <div className="mx-auto w-full max-w-md lg:mx-0 lg:ms-auto">
          <div className="rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl sm:p-8">
            <h1 className="text-2xl font-semibold text-ink">{title}</h1>
            {subtitle ? <p className="mt-1.5 text-sm text-muted">{subtitle}</p> : null}
            <div className="mt-6">{children}</div>
          </div>
          <p className="mt-5 text-center text-sm text-slate-400 lg:text-start">{footer}</p>
        </div>
      </div>
    </main>
  );
}
