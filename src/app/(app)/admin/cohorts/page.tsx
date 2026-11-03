import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Cohort management moved to the sidebar's course/cohort tree (§17). */
export default function AdminCohortsMoved() {
  redirect("/workspace");
}
