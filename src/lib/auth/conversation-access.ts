import { NextResponse } from "next/server";
import { requireTraineeAccess, type TraineeAccessLevel } from "@/lib/auth/access";
import { canAccessConversation } from "@/lib/auth/conversation-policy";
import { getConversationMeta, type ConversationMeta } from "@/lib/data/conversations";

/**
 * Authorize access to a conversation BY ID. A conversationId alone is never enough:
 *   1. load the conversation's {traineeId, ownerId} (no content leak);
 *   2. require live access to that trainee (`requireTraineeAccess`, fresh from DB);
 *   3. `canAccessConversation` — the owner, or an authorized manager (admin/super).
 * Missing / unauthorized → generic 404 (no existence disclosure).
 *
 * Server-only.
 */
export type ConversationAccess =
  | { ok: true; actorId: string; via: TraineeAccessLevel; meta: ConversationMeta }
  | { ok: false; response: NextResponse };

function notFound(): NextResponse {
  return NextResponse.json({ error: "אין לך הרשאה לצפות או לבצע פעולה זו." }, { status: 404 });
}

export async function requireConversationAccess(conversationId: string): Promise<ConversationAccess> {
  const meta = await getConversationMeta(conversationId);
  if (!meta) return { ok: false, response: notFound() };

  const access = await requireTraineeAccess(meta.traineeId);
  if (!access.ok) return { ok: false, response: access.response };

  if (!canAccessConversation(access.actorId, access.via, meta)) {
    return { ok: false, response: notFound() };
  }
  return { ok: true, actorId: access.actorId, via: access.via, meta };
}
