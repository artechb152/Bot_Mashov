import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The dedicated signup screen was folded into the entry page (`/`). This route is kept
 * only as a backward-compatible redirect to the entry page in signup mode — it never
 * renders a separate signup screen.
 */
export default function SignupPage() {
  redirect("/?mode=signup");
}
