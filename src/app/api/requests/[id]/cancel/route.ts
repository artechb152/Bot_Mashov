import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/require-active";
import { cancelRequest } from "@/lib/data/requests";
import { decisionError } from "@/lib/data/request-http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// POST /api/requests/[id]/cancel — the REQUESTER cancels their own pending request.
export async function POST(_request: Request, { params }: RouteContext) {
  const auth = await requireActiveAccount();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const result = await cancelRequest(auth.account, id);
  if (result.ok) return NextResponse.json({ ok: true });
  return decisionError(result.reason);
}
