import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The "access requests" feature was removed from the product (§9). Redirect away. */
export default function RequestsRemoved() {
  redirect("/workspace");
}
