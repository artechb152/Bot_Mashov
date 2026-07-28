import { isValidObjectId, Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Notification } from "@/models";

/**
 * In-app notification service. `notify`/`notifyMany` are best-effort (a failed
 * notification never breaks the primary operation). Notification text must never
 * carry protected data — pass short Hebrew title/body only, and a `link` the target
 * route will independently authorize.
 *
 * Server-only.
 */

export type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  relatedType?: string;
  relatedId?: string;
  link?: string;
};

export type NotificationDTO = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string | null;
};

type LeanNotif = {
  _id: unknown;
  type?: string;
  title?: string;
  body?: string | null;
  link?: string | null;
  readAt?: Date | string | null;
  createdAt?: Date | string;
};

function serialize(doc: LeanNotif): NotificationDTO {
  return {
    id: String(doc._id),
    type: doc.type ?? "",
    title: doc.title ?? "",
    body: doc.body ?? null,
    link: doc.link ?? null,
    read: Boolean(doc.readAt),
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
  };
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    if (!isValidObjectId(input.userId)) return;
    await connectToDatabase();
    await Notification.create({
      userId: new Types.ObjectId(input.userId),
      type: input.type,
      title: input.title,
      body: input.body,
      relatedType: input.relatedType,
      relatedId: input.relatedId && isValidObjectId(input.relatedId) ? new Types.ObjectId(input.relatedId) : undefined,
      link: input.link,
    });
  } catch (err) {
    console.error("[notify] failed:", err);
  }
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">): Promise<void> {
  try {
    const ids = [...new Set(userIds)].filter((id) => isValidObjectId(id));
    if (ids.length === 0) return;
    await connectToDatabase();
    await Notification.insertMany(
      ids.map((userId) => ({
        userId: new Types.ObjectId(userId),
        type: input.type,
        title: input.title,
        body: input.body,
        relatedType: input.relatedType,
        relatedId: input.relatedId && isValidObjectId(input.relatedId) ? new Types.ObjectId(input.relatedId) : undefined,
        link: input.link,
      })),
      { ordered: false },
    );
  } catch (err) {
    console.error("[notifyMany] failed:", err);
  }
}

export async function unreadCount(userId: string): Promise<number> {
  if (!isValidObjectId(userId)) return 0;
  await connectToDatabase();
  return Notification.countDocuments({ userId, readAt: { $exists: false } });
}

export async function listNotifications(userId: string, opts: { limit?: number } = {}): Promise<NotificationDTO[]> {
  if (!isValidObjectId(userId)) return [];
  await connectToDatabase();
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const docs = await Notification.find({ userId }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean<LeanNotif[]>();
  return docs.map(serialize);
}

/** Mark one notification read — only if it belongs to this user (scope in the filter). */
export async function markRead(userId: string, notificationId: string): Promise<boolean> {
  if (!isValidObjectId(userId) || !isValidObjectId(notificationId)) return false;
  await connectToDatabase();
  const res = await Notification.updateOne(
    { _id: notificationId, userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  return res.matchedCount > 0;
}

export async function markAllRead(userId: string): Promise<number> {
  if (!isValidObjectId(userId)) return 0;
  await connectToDatabase();
  const res = await Notification.updateMany(
    { userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
  return res.modifiedCount ?? 0;
}
