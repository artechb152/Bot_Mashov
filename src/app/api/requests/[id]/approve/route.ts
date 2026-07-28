import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/require-active";
import { approveRequest } from "@/lib/data/requests";
import { decisionError } from "@/lib/data/request-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/requests/[id]/approve — reviewer approves (requires a review note).
export async function POST(request: Request, { params }: RouteContext) {
  const auth = await requireActiveAccount();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const b = (await request.json().catch(() => ({}))) as { note?: string };
  const result = await approveRequest(auth.account, id, b.note ?? "");
  if (result.ok) return NextResponse.json({ ok: true });
  return decisionError(result.reason);
}
