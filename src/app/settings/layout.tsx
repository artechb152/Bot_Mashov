import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { getAccount } from "@/lib/auth/account";

/**
 * The profile area — a SINGLE page (§1/§12/§13): account details + password. It is not
 * a navigation hub and has no tabs; there are no links to administration, notifications,
 * courses, cohorts, or access codes. Reached only from the user menu ("פרופיל").
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/");
  if (account.status !== "active") redirect("/");

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <Link
          href="/workspace"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:underline"
        >
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
          חזרה לאזור העבודה
        </Link>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-ink">פרופיל</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
