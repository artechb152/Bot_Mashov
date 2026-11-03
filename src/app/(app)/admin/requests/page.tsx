import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** "Access requests" removed (§9). */
export default function AdminRequestsRemoved() {
  redirect("/admin/users");
}
