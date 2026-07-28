import { NextResponse } from "next/server";
import { getAccount, type Account } from "@/lib/auth/account";
import type { UserRole, UserStatus } from "@/lib/domain/types";

/**
 * The base gate: an authenticated user whose account is `active`.
 *
 * Account status is enforced HERE (and in every gate built on this) rather than by
 * nulling `getAccount()`, so a suspended/disabled user reaches a clear Hebrew
 * surface but no data gate ever passes them. Status is read DB-fresh (like role),
 * so suspension is effective on the next request — this is not live session
 * revocation, just a re-read of a DB field.
 *
 * Returns a branded `AuthGrant`: its brand symbol is module-private, so the value
 * cannot be forged. Server-only.
 */

declare const AUTH_BRAND: unique symbol;

export type AuthGrant = {
  readonly userId: string;
  readonly role: UserRole;
  readonly isRoot: boolean;
  readonly [AUTH_BRAND]: true;
};

export type AuthResult = { ok: true; grant: AuthGrant } | { ok: false; response: NextResponse };

/** True only when the account may access anything at all. */
export function isActive(account: Account): boolean {
  return account.status === "active";
}

/** The exact Response to return for a non-active account (generic, no detail leak). */
export function inactiveResponse(status: UserStatus): NextResponse {
  const error =
    status === "suspended"
      ? "החשבון מושהה זמנית. יש לפנות למנהל המערכת."
      : "החשבון מושבת. יש לפנות למנהל המערכת.";
  return NextResponse.json({ error }, { status: 403 });
}

/** 401 for no session — shared wording across gates. */
export function unauthenticatedResponse(): NextResponse {
  return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
}

export async function requireActiveUser(): Promise<AuthResult> {
  const account = await getAccount();
  if (!account) return { ok: false, response: unauthenticatedResponse() };
  if (!isActive(account)) return { ok: false, response: inactiveResponse(account.status) };
  return {
    ok: true,
    grant: {
      userId: account.id,
      role: account.role,
      isRoot: account.isRootSuperAdmin,
    } as AuthGrant,
  };
}

/** Like requireActiveUser but returns the full DB-fresh Account (role + course). */
export async function requireActiveAccount(): Promise<
  { ok: true; account: Account } | { ok: false; response: NextResponse }
> {
  const account = await getAccount();
  if (!account) return { ok: false, response: unauthenticatedResponse() };
  if (!isActive(account)) return { ok: false, response: inactiveResponse(account.status) };
  return { ok: true, account };
}
