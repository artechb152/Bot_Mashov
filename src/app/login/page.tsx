import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ next?: string }> };

/**
 * The dedicated login screen was folded into the entry page (`/`). This route is kept
 * only as a backward-compatible redirect (bookmarks, the middleware's older target)
 * — it never renders a separate login screen. `?next=` is preserved.
 */
export default async function LoginPage({ searchParams }: PageProps) {
  const { next } = await searchParams;
  redirect(next ? `/?next=${encodeURIComponent(next)}` : "/");
}
