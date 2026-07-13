import { Compass } from "lucide-react";
import { siteConfig } from "@/lib/config";

/**
 * Shared shell for the auth pages: dark-navy full screen (matching the landing),
 * brand mark on top, a clean white panel with the form, and a footer link. RTL.
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
      className="relative flex min-h-dvh flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 focus:outline-none"
    >
      <div className="mb-8 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-900">
          <Compass className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="text-lg font-semibold text-white">{siteConfig.name}</span>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 text-ink shadow-2xl sm:p-8">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </div>

      <p className="mt-6 text-sm text-slate-400">{footer}</p>
    </main>
  );
}
