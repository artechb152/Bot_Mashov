import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

/**
 * A lightweight in-app notification for one user. No browser push; the UI polls /
 * refreshes. Notification TEXT must never contain protected data — it is a short
 * Hebrew title + optional body, plus a link the target route independently gates.
 */
const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String },
    // What the notification points at, for building the (authorized) link.
    relatedType: { type: String },
    relatedId: { type: Schema.Types.ObjectId },
    link: { type: String },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ userId: 1, readAt: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;

export const Notification: Model<NotificationDoc> =
  (models.Notification as Model<NotificationDoc>) ??
  model<NotificationDoc>("Notification", notificationSchema);
