import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The management area now opens directly on the users page (§14/§15). */
export default function SystemHomeRedirect() {
  redirect("/system/users");
}
