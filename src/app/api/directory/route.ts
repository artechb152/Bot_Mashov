import { NextResponse } from "next/server";
import { getAccount } from "@/lib/auth/account";
import { listDirectory } from "@/lib/data/directory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/directory — the role-appropriate people directory for the sidebar flyout.
 * Same server-side scoping as the page (`listDirectory`): a staff viewer sees their
 * course + supers; the hidden platform-owner is never included.
 */
export async function GET() {
  const account = await getAccount();
  if (!account) return NextResponse.json({ error: "לא מחובר." }, { status: 401 });
  if (account.status !== "active") return NextResponse.json({ error: "החשבון אינו פעיל." }, { status: 403 });

  const directory = await listDirectory(account);
  return NextResponse.json({ directory });
}
