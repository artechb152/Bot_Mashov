import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  InternalMessage,
  InternalMessageThread,
  MessageAttachment,
  MessageDraft,
  ThreadParticipantState,
  Trainee,
  User,
} from "@/models";
import type { Account } from "@/lib/auth/account";
import { resolveRecipients, type RecipientSpec } from "@/lib/data/recipients";
import { traineeAccessLevel } from "@/lib/data/trainee-grants";
import { notifyMany } from "@/lib/data/notifications";
import type { MessageThreadType } from "@/lib/domain/types";

/**
 * Internal messaging data layer. Thread access is by PARTICIPATION only; recipients
 * are resolved to concrete IDs at send time (see recipients.ts) and frozen. Per-user
 * read/archive/delete state never affects other participants. Server-only.
 */

export type MessageFileInput = { originalName: string; mimeType: string; size: number; content: Buffer };

export type ThreadListItem = {
  id: string;
  subject: string;
  threadType: MessageThreadType;
  lastMessageAt: string | null;
  unread: boolean;
  participantCount: number;
  snippet: string;
  mine: boolean;
};

export type TraineeRef = { id: string; name: string; accessible: boolean; href: string | null };

export type MessageItem = {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  isSystem: boolean;
  mine: boolean;
  sentAt: string | null;
  attachments: { id: string; filename: string; mimeType: string; size: number }[];
};

export type ThreadDetail = {
  id: string;
  subject: string;
  threadType: MessageThreadType;
  participants: { id: string; name: string }[];
  messages: MessageItem[];
  traineeRefs: TraineeRef[];
};

async function userName(id: string): Promise<string> {
  const u = await User.findById(id).select("displayName username").lean<{ displayName?: string; username?: string } | null>();
  return u?.displayName || u?.username || "משתמש";
}

async function namesFor(ids: string[]): Promise<Map<string, string>> {
  const users = await User.find({ _id: { $in: ids } })
    .select("_id displayName username")
    .lean<{ _id: unknown; displayName?: string; username?: string }[]>();
  return new Map(users.map((u) => [String(u._id), u.displayName || u.username || "משתמש"]));
}

/* -------------------------------------------------------------------------- */
/* Participation                                                               */
/* -------------------------------------------------------------------------- */

export async function isParticipant(userId: string, threadId: string): Promise<boolean> {
  if (!isValidObjectId(threadId) || !isValidObjectId(userId)) return false;
  await connectToDatabase();
  const t = await InternalMessageThread.findOne({ _id: threadId, participantIds: new Types.ObjectId(userId) })
    .select("_id")
    .lean();
  return Boolean(t);
}

/* -------------------------------------------------------------------------- */
/* Attachments (stored per message; participant-gated download)                */
/* -------------------------------------------------------------------------- */

async function storeAttachments(
  threadId: string,
  messageId: string,
  uploadedBy: string,
  files: MessageFileInput[],
): Promise<{ attachmentId: string; filename: string; mimeType: string; size: number }[]> {
  const out: { attachmentId: string; filename: string; mimeType: string; size: number }[] = [];
  for (const f of files) {
    const doc = await MessageAttachment.create({
      threadId: new Types.ObjectId(threadId),
      messageId: new Types.ObjectId(messageId),
      uploadedBy: new Types.ObjectId(uploadedBy),
      originalName: f.originalName,
      mimeType: f.mimeType,
      size: f.size,
      content: f.content,
    });
    out.push({ attachmentId: String(doc._id), filename: f.originalName, mimeType: f.mimeType, size: f.size });
  }
  return out;
}

/** Fetch an attachment's bytes — only if the requesting user participates in its thread. */
export async function getMessageAttachmentForUser(
  userId: string,
  attachmentId: string,
): Promise<{ originalName: string; mimeType: string; content: Buffer } | null> {
  if (!isValidObjectId(attachmentId) || !isValidObjectId(userId)) return null;
  await connectToDatabase();
  const att = await MessageAttachment.findById(attachmentId).lean<{ threadId?: unknown; originalName?: string; mimeType?: string; content?: unknown } | null>();
  if (!att) return null;
  const ok = await isParticipant(userId, String(att.threadId));
  if (!ok) return null;
  const content = att.content;
  const buf = Buffer.isBuffer(content)
    ? content
    : content && typeof content === "object" && "buffer" in content && Buffer.isBuffer((content as { buffer: unknown }).buffer)
      ? (content as { buffer: Buffer }).buffer
      : null;
  if (!buf) return null;
  return { originalName: att.originalName ?? "attachment", mimeType: att.mimeType ?? "application/octet-stream", content: buf };
}

/* -------------------------------------------------------------------------- */
/* Create / reply                                                              */
/* -------------------------------------------------------------------------- */

export type CreateThreadInput = {
  subject: string;
  body: string;
  spec: RecipientSpec;
  threadType?: MessageThreadType;
  files?: MessageFileInput[];
  relatedTraineeIds?: string[];
  system?: boolean;
};

export type CreateThreadResult =
  | { ok: true; threadId: string; recipientCount: number }
  | { ok: false; error: string };

export async function createThread(account: Account, input: CreateThreadInput): Promise<CreateThreadResult> {
  await connectToDatabase();
  const subject = (input.subject ?? "").trim() || "(ללא נושא)";

  const resolved = await resolveRecipients(account, input.spec, { system: input.system });
  if (!resolved.ok) return { ok: false, error: resolved.error };
  if (resolved.total === 0) return { ok: false, error: "יש לבחור לפחות נמען אחד." };

  const participantIds = [...new Set([account.id, ...resolved.userIds])];
  const now = new Date();

  const thread = await InternalMessageThread.create({
    subject,
    threadType: input.threadType ?? (resolved.total > 1 ? "broadcast" : "direct"),
    courseId: account.courseId ? new Types.ObjectId(account.courseId) : undefined,
    createdBy: new Types.ObjectId(account.id),
    participantIds: participantIds.map((id) => new Types.ObjectId(id)),
    resolvedRecipientSnapshot: resolved.snapshot,
    relatedTraineeIds: (input.relatedTraineeIds ?? []).filter(isValidObjectId).map((id) => new Types.ObjectId(id)),
    lastMessageAt: now,
  });

  const message = await InternalMessage.create({
    threadId: thread._id,
    senderId: new Types.ObjectId(account.id),
    body: input.body ?? "",
    isSystem: Boolean(input.system),
    sentAt: now,
  });

  if (input.files && input.files.length > 0) {
    const metas = await storeAttachments(String(thread._id), String(message._id), account.id, input.files);
    await InternalMessage.updateOne({ _id: message._id }, { $set: { attachments: metas } });
  }

  // Participant states: the sender has read; recipients are unread.
  await ThreadParticipantState.insertMany(
    participantIds.map((uid) => ({
      threadId: thread._id,
      userId: new Types.ObjectId(uid),
      readAt: uid === account.id ? now : undefined,
    })),
    { ordered: false },
  ).catch(() => {});

  await notifyMany(resolved.userIds, {
    type: "message.new",
    title: "הודעה חדשה",
    body: subject,
    relatedType: "message",
    relatedId: String(thread._id),
    link: `/messages/${String(thread._id)}`,
  });

  return { ok: true, threadId: String(thread._id), recipientCount: resolved.total };
}

/** Create a system thread with explicit participants (used by the request system). */
export async function createSystemThread(input: {
  subject: string;
  body: string;
  createdBy: string;
  participantIds: string[];
  relatedRequestId?: string;
  relatedTraineeIds?: string[];
}): Promise<string> {
  await connectToDatabase();
  const now = new Date();
  const participants = [...new Set(input.participantIds.filter(isValidObjectId))];
  const thread = await InternalMessageThread.create({
    subject: input.subject,
    threadType: "request",
    createdBy: new Types.ObjectId(input.createdBy),
    participantIds: participants.map((id) => new Types.ObjectId(id)),
    relatedRequestId: input.relatedRequestId && isValidObjectId(input.relatedRequestId) ? new Types.ObjectId(input.relatedRequestId) : undefined,
    relatedTraineeIds: (input.relatedTraineeIds ?? []).filter(isValidObjectId).map((id) => new Types.ObjectId(id)),
    lastMessageAt: now,
  });
  await InternalMessage.create({
    threadId: thread._id,
    senderId: new Types.ObjectId(input.createdBy),
    body: input.body,
    isSystem: true,
    sentAt: now,
  });
  await ThreadParticipantState.insertMany(
    participants.map((uid) => ({ threadId: thread._id, userId: new Types.ObjectId(uid), readAt: uid === input.createdBy ? now : undefined })),
    { ordered: false },
  ).catch(() => {});
  return String(thread._id);
}

/** Append a system message to an existing thread (e.g. request approved/rejected). */
export async function appendSystemMessage(threadId: string, senderId: string, body: string): Promise<void> {
  if (!isValidObjectId(threadId)) return;
  await connectToDatabase();
  const now = new Date();
  await InternalMessage.create({ threadId: new Types.ObjectId(threadId), senderId: new Types.ObjectId(senderId), body, isSystem: true, sentAt: now });
  await InternalMessageThread.updateOne({ _id: threadId }, { $set: { lastMessageAt: now } });
}

export async function reply(
  account: Account,
  threadId: string,
  body: string,
  files: MessageFileInput[] = [],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(await isParticipant(account.id, threadId))) {
    return { ok: false, error: "אין לך הרשאה לצפות או לבצע פעולה זו." };
  }
  await connectToDatabase();
  const now = new Date();
  const message = await InternalMessage.create({
    threadId: new Types.ObjectId(threadId),
    senderId: new Types.ObjectId(account.id),
    body: body ?? "",
    sentAt: now,
  });
  if (files.length > 0) {
    const metas = await storeAttachments(threadId, String(message._id), account.id, files);
    await InternalMessage.updateOne({ _id: message._id }, { $set: { attachments: metas } });
  }
  await InternalMessageThread.updateOne({ _id: threadId }, { $set: { lastMessageAt: now } });
  // Sender has read up to their own message.
  await ThreadParticipantState.updateOne({ threadId, userId: account.id }, { $set: { readAt: now } });

  const thread = await InternalMessageThread.findById(threadId).select("subject participantIds").lean<{ subject?: string; participantIds?: unknown[] } | null>();
  const others = (thread?.participantIds ?? []).map(String).filter((id) => id !== account.id);
  await notifyMany(others, {
    type: "message.new",
    title: "הודעה חדשה",
    body: thread?.subject ?? "",
    relatedType: "message",
    relatedId: threadId,
    link: `/messages/${threadId}`,
  });
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Listing                                                                     */
/* -------------------------------------------------------------------------- */

export type Folder = "inbox" | "sent" | "archive";

export async function listThreads(account: Account, folder: Folder): Promise<ThreadListItem[]> {
  await connectToDatabase();
  const uid = new Types.ObjectId(account.id);

  let threadIds: Types.ObjectId[];
  if (folder === "sent") {
    const authored = await InternalMessage.distinct("threadId", { senderId: uid });
    const deleted = await ThreadParticipantState.find({ userId: uid, deletedForUserAt: { $exists: true } }).select("threadId").lean<{ threadId?: unknown }[]>();
    const deletedSet = new Set(deleted.map((d) => String(d.threadId)));
    threadIds = (authored as unknown[]).map((t) => new Types.ObjectId(String(t))).filter((t) => !deletedSet.has(String(t)));
  } else {
    const q: Record<string, unknown> = { userId: uid, deletedForUserAt: { $exists: false } };
    q.archivedAt = folder === "archive" ? { $exists: true } : { $exists: false };
    const states = await ThreadParticipantState.find(q).select("threadId").lean<{ threadId?: unknown }[]>();
    threadIds = states.map((s) => new Types.ObjectId(String(s.threadId)));
  }
  if (threadIds.length === 0) return [];

  const [threads, states, lastMsgs] = await Promise.all([
    InternalMessageThread.find({ _id: { $in: threadIds } }).sort({ lastMessageAt: -1 }).lean<{ _id: unknown; subject?: string; threadType?: string; lastMessageAt?: Date | string; participantIds?: unknown[]; createdBy?: unknown }[]>(),
    ThreadParticipantState.find({ userId: uid, threadId: { $in: threadIds } }).select("threadId readAt").lean<{ threadId?: unknown; readAt?: Date | string }[]>(),
    InternalMessage.aggregate<{ _id: unknown; body: string }>([
      { $match: { threadId: { $in: threadIds } } },
      { $sort: { sentAt: -1 } },
      { $group: { _id: "$threadId", body: { $first: "$body" } } },
    ]),
  ]);

  const readByThread = new Map(states.map((s) => [String(s.threadId), s.readAt ? new Date(s.readAt).getTime() : 0]));
  const snippetByThread = new Map(lastMsgs.map((m) => [String(m._id), m.body ?? ""]));

  return threads.map((t) => {
    const last = t.lastMessageAt ? new Date(t.lastMessageAt).getTime() : 0;
    const read = readByThread.get(String(t._id)) ?? 0;
    const snippet = (snippetByThread.get(String(t._id)) ?? "").slice(0, 100);
    return {
      id: String(t._id),
      subject: t.subject ?? "",
      threadType: (t.threadType as MessageThreadType) ?? "direct",
      lastMessageAt: t.lastMessageAt ? new Date(t.lastMessageAt).toISOString() : null,
      unread: read < last,
      participantCount: Array.isArray(t.participantIds) ? t.participantIds.length : 0,
      snippet,
      mine: String(t.createdBy) === account.id,
    };
  });
}

export async function unreadThreadCount(userId: string): Promise<number> {
  if (!isValidObjectId(userId)) return 0;
  await connectToDatabase();
  const uid = new Types.ObjectId(userId);
  const states = await ThreadParticipantState.find({ userId: uid, deletedForUserAt: { $exists: false }, archivedAt: { $exists: false } })
    .select("threadId readAt")
    .lean<{ threadId?: unknown; readAt?: Date | string }[]>();
  if (states.length === 0) return 0;
  const threads = await InternalMessageThread.find({ _id: { $in: states.map((s) => new Types.ObjectId(String(s.threadId))) } })
    .select("_id lastMessageAt")
    .lean<{ _id: unknown; lastMessageAt?: Date | string }[]>();
  const lastById = new Map(threads.map((t) => [String(t._id), t.lastMessageAt ? new Date(t.lastMessageAt).getTime() : 0]));
  let n = 0;
  for (const s of states) {
    const read = s.readAt ? new Date(s.readAt).getTime() : 0;
    if (read < (lastById.get(String(s.threadId)) ?? 0)) n++;
  }
  return n;
}

/* -------------------------------------------------------------------------- */
/* Thread detail (participant-gated) + per-user state                          */
/* -------------------------------------------------------------------------- */

export async function getThreadForUser(account: Account, threadId: string): Promise<ThreadDetail | null> {
  if (!isValidObjectId(threadId)) return null;
  await connectToDatabase();
  const thread = await InternalMessageThread.findOne({ _id: threadId, participantIds: new Types.ObjectId(account.id) })
    .lean<{ _id: unknown; subject?: string; threadType?: string; participantIds?: unknown[]; relatedTraineeIds?: unknown[] } | null>();
  if (!thread) return null; // not a participant → not found (no probing)

  const messages = await InternalMessage.find({ threadId }).sort({ sentAt: 1 }).lean<{ _id: unknown; senderId?: unknown; body?: string; isSystem?: boolean; sentAt?: Date | string; attachments?: { attachmentId: unknown; filename?: string; mimeType?: string; size?: number }[] }[]>();

  const participantIds = (thread.participantIds ?? []).map(String);
  const names = await namesFor([...participantIds, ...messages.map((m) => String(m.senderId))]);

  // Mark read up to now.
  await ThreadParticipantState.updateOne(
    { threadId, userId: account.id },
    { $set: { readAt: new Date() } },
    { upsert: true },
  );

  // Trainee references — accessible link vs restricted, per THIS viewer.
  const traineeRefs: TraineeRef[] = [];
  for (const tid of (thread.relatedTraineeIds ?? []).map(String)) {
    const level = await traineeAccessLevel(account, tid);
    if (level === "none") {
      traineeRefs.push({ id: tid, name: "תיק חניך מוגבל — נדרשת הרשאה", accessible: false, href: null });
    } else {
      const t = await Trainee.findById(tid).select("fullName").lean<{ fullName?: string } | null>();
      // staff-level access (owner or view/edit grant) → staff page; admin/super → admin page.
      const staffLevel = level === "owner" || level === "view" || level === "edit";
      const href = staffLevel ? `/trainees/${tid}` : `/admin/trainees/${tid}`;
      traineeRefs.push({ id: tid, name: t?.fullName ?? "תיק חניך", accessible: true, href });
    }
  }

  return {
    id: String(thread._id),
    subject: thread.subject ?? "",
    threadType: (thread.threadType as MessageThreadType) ?? "direct",
    participants: participantIds.map((id) => ({ id, name: names.get(id) ?? "משתמש" })),
    messages: messages.map((m) => ({
      id: String(m._id),
      senderId: String(m.senderId),
      senderName: names.get(String(m.senderId)) ?? "משתמש",
      body: m.body ?? "",
      isSystem: Boolean(m.isSystem),
      mine: String(m.senderId) === account.id,
      sentAt: m.sentAt ? new Date(m.sentAt).toISOString() : null,
      attachments: Array.isArray(m.attachments)
        ? m.attachments.map((a) => ({ id: String(a.attachmentId), filename: a.filename ?? "קובץ", mimeType: a.mimeType ?? "", size: a.size ?? 0 }))
        : [],
    })),
    traineeRefs,
  };
}

export async function setThreadArchived(userId: string, threadId: string, archived: boolean): Promise<boolean> {
  if (!(await isParticipant(userId, threadId))) return false;
  await connectToDatabase();
  await ThreadParticipantState.updateOne(
    { threadId, userId },
    archived ? { $set: { archivedAt: new Date() } } : { $unset: { archivedAt: "" } },
    { upsert: true },
  );
  return true;
}

export async function setThreadDeletedForUser(userId: string, threadId: string): Promise<boolean> {
  if (!(await isParticipant(userId, threadId))) return false;
  await connectToDatabase();
  await ThreadParticipantState.updateOne({ threadId, userId }, { $set: { deletedForUserAt: new Date() } }, { upsert: true });
  return true;
}

/* -------------------------------------------------------------------------- */
/* Drafts                                                                      */
/* -------------------------------------------------------------------------- */

export type DraftDTO = { id: string; subject: string; body: string; updatedAt: string | null };

export async function listDrafts(userId: string): Promise<DraftDTO[]> {
  if (!isValidObjectId(userId)) return [];
  await connectToDatabase();
  const docs = await MessageDraft.find({ userId }).sort({ updatedAt: -1 }).lean<{ _id: unknown; subject?: string; body?: string; updatedAt?: Date | string }[]>();
  return docs.map((d) => ({ id: String(d._id), subject: d.subject ?? "", body: d.body ?? "", updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null }));
}

export async function saveDraft(userId: string, input: { id?: string; subject?: string; body?: string; recipientSpec?: unknown }): Promise<string> {
  await connectToDatabase();
  if (input.id && isValidObjectId(input.id)) {
    await MessageDraft.updateOne({ _id: input.id, userId }, { $set: { subject: input.subject ?? "", body: input.body ?? "", recipientSpec: input.recipientSpec } });
    return input.id;
  }
  const doc = await MessageDraft.create({ userId: new Types.ObjectId(userId), subject: input.subject ?? "", body: input.body ?? "", recipientSpec: input.recipientSpec });
  return String(doc._id);
}

export async function getDraft(userId: string, draftId: string): Promise<{ id: string; subject: string; body: string; recipientSpec: unknown } | null> {
  if (!isValidObjectId(draftId)) return null;
  await connectToDatabase();
  const d = await MessageDraft.findOne({ _id: draftId, userId }).lean<{ _id: unknown; subject?: string; body?: string; recipientSpec?: unknown } | null>();
  return d ? { id: String(d._id), subject: d.subject ?? "", body: d.body ?? "", recipientSpec: d.recipientSpec } : null;
}

export async function deleteDraft(userId: string, draftId: string): Promise<boolean> {
  if (!isValidObjectId(draftId)) return false;
  await connectToDatabase();
  const res = await MessageDraft.deleteOne({ _id: draftId, userId });
  return (res.deletedCount ?? 0) > 0;
}

// Re-export for the header badge.
export { userName };
