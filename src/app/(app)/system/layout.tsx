import { redirect } from "next/navigation";
import { getAccount } from "@/lib/auth/account";

/**
 * Page-level gate for the super-admin system area, now inside the persistent (app)
 * shell (one shared sidebar). Only active super_admins reach it; every /api/system/*
 * handler re-checks via requireSuperAdmin().
 */
export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.role !== "super_admin" || account.status !== "active") redirect("/trainees");
  return <>{children}</>;
}
