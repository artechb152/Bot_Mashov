import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The standalone bot page was folded into the work area (/workspace), where the
 * assistant is the bottom panel. This route is kept only as a backward-compatible
 * redirect — it never renders the old chat screen.
 */
export default function AssistantPage() {
  redirect("/workspace");
}
