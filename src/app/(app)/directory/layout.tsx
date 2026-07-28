import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";

/**
 * Directory — cross-role (any active user), now inside the persistent (app) shell.
 * Standalone chrome removed; the shared sidebar navigates. (The directory becomes a
 * sidebar flyout in a later phase; for now it renders as a page inside the shell.)
 */
export default async function DirectoryLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.status !== "active") redirect("/login");

  return <div className="mx-auto max-w-3xl">{children}</div>;
}
