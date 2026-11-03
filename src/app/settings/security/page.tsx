import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** Password change now lives on the single profile page (§1/§12). */
export default function SecurityMerged() {
  redirect("/settings/profile");
}
