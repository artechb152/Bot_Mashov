import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getAccount } from "@/lib/auth/account";
import { SettingsNav } from "@/components/settings/SettingsNav";

/**
 * Settings is cross-role (any active user) and must NOT require a course, so it is
 * its own route group with a light container rather than the course-gated AppShell.
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.status !== "active") redirect("/login");

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link
          href="/trainees"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:underline"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          חזרה לאזור העבודה
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">פרופיל והגדרות</h1>
        <div className="mt-5">
          <SettingsNav />
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
