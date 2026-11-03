import { redirect } from "next/navigation";
import { AuthEntry } from "@/components/auth/AuthEntry";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ mode?: string; next?: string }> };

/**
 * The product entry point. There are exactly two states (no landing, no modal):
 *   - signed in  → straight to the work area (/workspace);
 *   - guest      → the self-contained login/signup page.
 * A returning user who still has a valid session lands directly in /workspace.
 */
export default async function HomePage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (user) redirect("/workspace");

  const { mode, next } = await searchParams;
  return <AuthEntry initialMode={mode === "signup" ? "signup" : "login"} next={next} />;
}
