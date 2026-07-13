import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Trainee, TraineeAttachment } from "@/models";

/**
 * Owner-scoped data layer for trainee file attachments. Files are stored as a
 * Buffer in a dedicated collection; every function filters by `ownerId` so a
 * user can only touch attachments they own.
 */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB per file

export const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME_TYPES.has(mime);
}

/** Metadata DTO (no binary content). */
export type AttachmentDTO = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string | null;
};

export type NewAttachment = {
  originalName: string;
  mimeType: string;
  size: number;
  content: Buffer;
};

type LeanAttachment = {
  _id: unknown;
  originalName?: string;
  mimeType?: string;
  size?: number;
  content?: Buffer;
  uploadedAt?: Date | string;
  createdAt?: Date | string;
};

function serialize(doc: LeanAttachment): AttachmentDTO {
  const when = doc.uploadedAt ?? doc.createdAt ?? null;
  return {
    id: String(doc._id),
    originalName: doc.originalName ?? "",
    mimeType: doc.mimeType ?? "application/octet-stream",
    size: typeof doc.size === "number" ? doc.size : 0,
    uploadedAt: when ? new Date(when).toISOString() : null,
  };
}

async function ownsTrainee(traineeId: string, ownerId: string): Promise<boolean> {
  const t = await Trainee.findOne({ _id: traineeId, commanderId: ownerId }).select("_id").lean();
  return Boolean(t);
}

export async function listAttachments(traineeId: string, ownerId: string): Promise<AttachmentDTO[]> {
  if (!isValidObjectId(traineeId)) return [];
  await connectToDatabase();
  const docs = await TraineeAttachment.find({ traineeId, ownerId })
    .select("-content")
    .sort({ createdAt: -1, _id: -1 })
    .lean<LeanAttachment[]>();
  return docs.map(serialize);
}

/** Create an attachment — returns null if the trainee is not owned by the user. */
export async function createAttachment(
  traineeId: string,
  ownerId: string,
  file: NewAttachment,
): Promise<AttachmentDTO | null> {
  if (!isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  if (!(await ownsTrainee(traineeId, ownerId))) return null;
  const doc = await TraineeAttachment.create({ traineeId, ownerId, ...file });
  return serialize(doc.toObject() as LeanAttachment);
}

export async function getAttachment(
  attachmentId: string,
  ownerId: string,
): Promise<{ originalName: string; mimeType: string; content: Buffer } | null> {
  if (!isValidObjectId(attachmentId)) return null;
  await connectToDatabase();
  const doc = await TraineeAttachment.findOne({ _id: attachmentId, ownerId }).lean<LeanAttachment | null>();
  if (!doc || !doc.content) return null;

  // `.lean()` returns a Buffer field as a BSON `Binary`, whose bytes live in its
  // `.buffer` property (Buffer.from(binary) would yield 0 bytes). Handle both.
  const raw: unknown = doc.content;
  let content: Buffer;
  if (Buffer.isBuffer(raw)) {
    content = raw;
  } else if (
    raw &&
    typeof raw === "object" &&
    "buffer" in raw &&
    Buffer.isBuffer((raw as { buffer: unknown }).buffer)
  ) {
    content = (raw as { buffer: Buffer }).buffer;
  } else {
    content = Buffer.from(raw as Uint8Array);
  }

  return {
    originalName: doc.originalName ?? "attachment",
    mimeType: doc.mimeType ?? "application/octet-stream",
    content,
  };
}

export async function deleteAttachment(attachmentId: string, ownerId: string): Promise<boolean> {
  if (!isValidObjectId(attachmentId)) return false;
  await connectToDatabase();
  const res = await TraineeAttachment.findOneAndDelete({ _id: attachmentId, ownerId })
    .select("_id")
    .lean();
  return Boolean(res);
}
