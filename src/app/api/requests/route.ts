import { NextResponse } from "next/server";
import { requireActiveAccount } from "@/lib/auth/require-active";
import { createRequest, type CreateRequestInput } from "@/lib/data/requests";
import { isAccessRequestType } from "@/lib/domain/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/requests — create a typed access request. Reviewers are chosen by the
// server; the browser never selects a reviewer.
export async function POST(request: Request) {
  const auth = await requireActiveAccount();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "גוף הבקשה אינו תקין." }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  if (!isAccessRequestType(b.requestType)) {
    return NextResponse.json({ error: "סוג בקשה לא תקין." }, { status: 400 });
  }

  const input: CreateRequestInput = {
    requestType: b.requestType,
    reason: typeof b.reason === "string" ? b.reason : "",
    targetTraineeId: typeof b.targetTraineeId === "string" ? b.targetTraineeId : undefined,
    targetTeamId: typeof b.targetTeamId === "string" ? b.targetTeamId : undefined,
    targetCohortId: typeof b.targetCohortId === "string" ? b.targetCohortId : undefined,
    targetCourseId: typeof b.targetCourseId === "string" ? b.targetCourseId : undefined,
    targetUserId: typeof b.targetUserId === "string" ? b.targetUserId : auth.account.id,
    payload: typeof b.payload === "object" && b.payload ? (b.payload as Record<string, unknown>) : undefined,
  };

  const result = await createRequest(auth.account, input);
  if (result.ok) return NextResponse.json({ id: result.id }, { status: 201 });

  const map: Record<string, [string, number]> = {
    invalid: ["הבקשה אינה תקינה. יש למלא סיבה ויעד.", 400],
    duplicate: ["כבר קיימת בקשה פתוחה מסוג זה.", 409],
    cooldown: ["יש להמתין לפני הגשת בקשה נוספת מסוג זה.", 429],
    no_reviewer: ["לא נמצא גורם מאשר מתאים.", 409],
  };
  const [msg, status] = map[result.reason] ?? ["הגשת הבקשה נכשלה.", 400];
  return NextResponse.json({ error: msg }, { status });
}
