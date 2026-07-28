import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Trainee, TraineeAttachment } from "@/models";
import type { OwnerScope } from "@/lib/data/scope";

/**
 * Owner+course-scoped data layer for trainee file attachments. Files are stored
 * as a Buffer in a dedicated collection; every function filters by BOTH the
 * owner id and the course, so a user can only touch attachments that are theirs
 * and in their course.
 */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024; // 5MB per file

export const ALLOWED_MIME_TYPES = new Set<string>([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
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
  /** Plain text pulled out of the file, when the format allows it. */
  extractedText?: string;
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

/** The owner+course filter every query below is built on. */
function scopeFilter(scope: OwnerScope) {
  return { ownerId: scope.ownerId, courseType: scope.courseType };
}

/** True only if the trainee exists AND is within the caller's owner+course scope. */
async function ownsTrainee(traineeId: string, scope: OwnerScope): Promise<boolean> {
  const t = await Trainee.findOne({
    _id: traineeId,
    commanderId: scope.ownerId,
    courseType: scope.courseType,
  })
    .select("_id")
    .lean();
  return Boolean(t);
}

export async function listAttachments(
  traineeId: string,
  scope: OwnerScope,
): Promise<AttachmentDTO[]> {
  if (!isValidObjectId(traineeId)) return [];
  await connectToDatabase();
  const docs = await TraineeAttachment.find({ traineeId, ...scopeFilter(scope) })
    .select("-content")
    .sort({ createdAt: -1, _id: -1 })
    .lean<LeanAttachment[]>();
  return docs.map(serialize);
}

/** Create an attachment — returns null if the trainee is not in the caller's scope. */
export async function createAttachment(
  traineeId: string,
  scope: OwnerScope,
  file: NewAttachment,
): Promise<AttachmentDTO | null> {
  if (!isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  if (!(await ownsTrainee(traineeId, scope))) return null;
  const doc = await TraineeAttachment.create({
    traineeId,
    ownerId: scope.ownerId,
    courseType: scope.courseType,
    ...file,
  });
  return serialize(doc.toObject() as LeanAttachment);
}

/**
 * Fetch an attachment's bytes. Scoped by trainee AND owner AND course: passing a
 * `traineeId` the attachment does not belong to yields null, so the id in the URL
 * path cannot be swapped for someone else's.
 */
export async function getAttachment(
  traineeId: string,
  attachmentId: string,
  scope: OwnerScope,
): Promise<{ originalName: string; mimeType: string; content: Buffer } | null> {
  if (!isValidObjectId(attachmentId) || !isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  const doc = await TraineeAttachment.findOne({
    _id: attachmentId,
    traineeId,
    ...scopeFilter(scope),
  }).lean<LeanAttachment | null>();
  if (!doc || !doc.content) return null;

  return {
    originalName: doc.originalName ?? "attachment",
    mimeType: doc.mimeType ?? "application/octet-stream",
    content: readBufferField(doc.content),
  };
}

/**
 * UNSCOPED attachment metadata read. Call ONLY after an access gate
 * (`requireTraineeAccess`) has authorized the caller (grant/admin/super view).
 */
export async function readAttachmentsById(traineeId: string): Promise<AttachmentDTO[]> {
  if (!isValidObjectId(traineeId)) return [];
  await connectToDatabase();
  const docs = await TraineeAttachment.find({ traineeId })
    .select("-content")
    .sort({ createdAt: -1, _id: -1 })
    .lean<LeanAttachment[]>();
  return docs.map(serialize);
}

/**
 * UNSCOPED attachment bytes read (still tied to its trainee to prevent attId-swap).
 * Call ONLY after `requireTraineeAccess` has authorized the caller.
 */
export async function readAttachmentContentById(
  traineeId: string,
  attachmentId: string,
): Promise<{ originalName: string; mimeType: string; content: Buffer } | null> {
  if (!isValidObjectId(attachmentId) || !isValidObjectId(traineeId)) return null;
  await connectToDatabase();
  const doc = await TraineeAttachment.findOne({ _id: attachmentId, traineeId }).lean<LeanAttachment | null>();
  if (!doc || !doc.content) return null;
  return {
    originalName: doc.originalName ?? "attachment",
    mimeType: doc.mimeType ?? "application/octet-stream",
    content: readBufferField(doc.content),
  };
}

/**
 * Normalise a `.lean()` Buffer field into a Node Buffer. Mongoose returns a
 * stored Buffer as a BSON `Binary`, whose bytes live in its `.buffer` property
 * (a plain `Buffer.from(binary)` would yield 0 bytes). Pure marshalling — no
 * scoping — so it is safe to reuse from the admin download path.
 */
export function readBufferField(raw: unknown): Buffer {
  if (Buffer.isBuffer(raw)) return raw;
  if (
    raw &&
    typeof raw === "object" &&
    "buffer" in raw &&
    Buffer.isBuffer((raw as { buffer: unknown }).buffer)
  ) {
    return (raw as { buffer: Buffer }).buffer;
  }
  return Buffer.from(raw as Uint8Array);
}

export async function deleteAttachment(
  traineeId: string,
  attachmentId: string,
  scope: OwnerScope,
): Promise<boolean> {
  if (!isValidObjectId(attachmentId) || !isValidObjectId(traineeId)) return false;
  await connectToDatabase();
  const res = await TraineeAttachment.findOneAndDelete({
    _id: attachmentId,
    traineeId,
    ...scopeFilter(scope),
  })
    .select("_id")
    .lean();
  return Boolean(res);
}
