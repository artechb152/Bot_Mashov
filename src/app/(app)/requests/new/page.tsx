import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";
import { NewRequestForm } from "@/components/requests/NewRequestForm";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const account = await getAccount();
  if (!account) redirect("/login");
  return <NewRequestForm />;
}
