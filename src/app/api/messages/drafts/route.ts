import { NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth/require-active";
import { listDrafts, saveDraft } from "@/lib/data/messages";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/messages/drafts — the current user's drafts.
export async function GET() {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ drafts: await listDrafts(auth.grant.userId) });
}

// POST /api/messages/drafts — create/update a draft (private to the author).
export async function POST(request: Request) {
  const auth = await requireActiveUser();
  if (!auth.ok) return auth.response;
  const b = (await request.json().catch(() => ({}))) as { id?: string; subject?: string; body?: string; recipientSpec?: unknown };
  const id = await saveDraft(auth.grant.userId, b);
  return NextResponse.json({ id });
}
