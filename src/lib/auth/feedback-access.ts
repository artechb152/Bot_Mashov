import { NextResponse } from "next/server";
import { requireTraineeAccess, type TraineeAccessLevel } from "@/lib/auth/access";
import { canEditFeedback } from "@/lib/auth/feedback-policy";
import { getFeedbackMeta, type FeedbackMeta } from "@/lib/data/feedback";

/**
 * Authorize a WRITE (edit / archive / restore) on an existing feedback entry.
 * Composes the live trainee access gate with feedback authorship:
 *   1. load the entry's {traineeId, authorId} (no content leak);
 *   2. require at least VIEW access to that trainee (fresh from the DB);
 *   3. allow only if `canEditFeedback(via, isAuthor)` — a write level, or the author.
 * Missing entry or insufficient access → generic 404 (no existence disclosure).
 *
 * Server-only.
 */
export type FeedbackWriteAuth =
  | { ok: true; actorId: string; via: TraineeAccessLevel; meta: FeedbackMeta }
  | { ok: false; response: NextResponse };

function notFound(): NextResponse {
  return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 404 });
}

export async function requireFeedbackWrite(feedbackId: string): Promise<FeedbackWriteAuth> {
  const meta = await getFeedbackMeta(feedbackId);
  if (!meta) return { ok: false, response: notFound() };

  const access = await requireTraineeAccess(meta.traineeId);
  if (!access.ok) return { ok: false, response: access.response };

  const isAuthor = access.actorId === meta.authorId;
  if (!canEditFeedback(access.via, isAuthor)) return { ok: false, response: notFound() };

  return { ok: true, actorId: access.actorId, via: access.via, meta };
}
