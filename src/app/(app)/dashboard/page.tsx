import { redirect } from "next/navigation";

/**
 * The dashboard was replaced by the standalone landing screen at `/`. This route
 * is kept (non-destructively) as a redirect so any old link/bookmark still works.
 */
export default function DashboardPage() {
  redirect("/");
}
