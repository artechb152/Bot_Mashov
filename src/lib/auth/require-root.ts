import { NextResponse } from "next/server";
import { getAccount } from "@/lib/auth/account";
import { isActive, inactiveResponse, unauthenticatedResponse } from "@/lib/auth/require-active";

/**
 * The narrowest gate: an active, protected ROOT super-admin. Root is the only tier
 * allowed to change user roles directly (spec §12) and to perform highest-level
 * hierarchy management. There is NO route that creates a root — root accounts are
 * minted only by the local bootstrap script.
 *
 * Returns a branded `RootGrant` (private brand → unforgeable). A generic 403 is
 * returned for a non-root user, so the response never reveals whether root even
 * exists. Server-only.
 */

declare const ROOT_BRAND: unique symbol;

export type RootGrant = {
  readonly rootId: string;
  readonly [ROOT_BRAND]: true;
};

export type RootResult = { ok: true; grant: RootGrant } | { ok: false; response: NextResponse };

export async function requireRootSuperAdmin(): Promise<RootResult> {
  const account = await getAccount();
  if (!account) return { ok: false, response: unauthenticatedResponse() };
  if (!isActive(account)) return { ok: false, response: inactiveResponse(account.status) };
  if (account.role !== "super_admin" || account.isRootSuperAdmin !== true) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "אין לך הרשאה לצפות או לבצע פעולה זו." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, grant: { rootId: account.id } as RootGrant };
}
