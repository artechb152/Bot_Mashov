import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/require-active";
import { listRecipientOptions } from "@/lib/data/recipients";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/messages/recipients — the recipient options the current user may address.
export async function GET() {
  const auth = await requireActiveAccount();
  if (!auth.ok) return auth.response;
  return NextResponse.json(await listRecipientOptions(auth.account));
}
