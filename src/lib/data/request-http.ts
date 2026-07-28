import { NextResponse } from "next/server";

/** Map a request DecisionResult failure reason to a Hebrew HTTP response. */
export function decisionError(reason: string): NextResponse {
  const map: Record<string, [string, number]> = {
    not_found: ["הבקשה לא נמצאה.", 404],
    not_reviewer: ["אין לך הרשאה לצפות או לבצע פעולה זו.", 403],
    forbidden: ["אין לך הרשאה לצפות או לבצע פעולה זו.", 403],
    not_pending: ["הבקשה כבר טופלה.", 409],
    invalid_target: ["יעד הבקשה אינו תקף עוד ולכן לא ניתן לאשר.", 409],
    note_required: ["יש להזין הערת מאשר.", 400],
  };
  const [msg, status] = map[reason] ?? ["הפעולה נכשלה.", 400];
  return NextResponse.json({ error: msg }, { status });
}
