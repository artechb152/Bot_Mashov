import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Trainee } from "@/models";

/**
 * Data-access layer for trainees. Route handlers and server components call
 * these functions instead of touching Mongoose directly. Everything returned is
 * a plain, serialisable DTO (no ObjectId / Date) so it can cross the
 * server→client boundary safely.
 */

export type TraineeDTO = {
  id: string;
  fullName: string;
  team: string;
  strengths: string[];
  weaknesses: string[];
  notes: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TraineeInput = {
  fullName: string;
  team: string;
  strengths: string[];
  weaknesses: string[];
  notes: string;
};

type LeanTrainee = {
  _id: unknown;
  fullName?: string;
  team?: string;
  strengths?: string[];
  weaknesses?: string[];
  notes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
};

function serialize(doc: LeanTrainee): TraineeDTO {
  return {
    id: String(doc._id),
    fullName: doc.fullName ?? "",
    team: doc.team ?? "",
    strengths: Array.isArray(doc.strengths) ? doc.strengths : [],
    weaknesses: Array.isArray(doc.weaknesses) ? doc.weaknesses : [],
    notes: doc.notes ?? "",
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

/**
 * All functions are OWNER-SCOPED: `ownerId` is the authenticated user's id
 * (from the session). Every query filters by `commanderId: ownerId`, so a user
 * can only list/read/update/delete their own trainees, and new trainees are
 * created owned by them.
 */

export async function listTrainees(ownerId: string): Promise<TraineeDTO[]> {
  await connectToDatabase();
  const docs = await Trainee.find({ commanderId: ownerId })
    .sort({ createdAt: -1, _id: -1 })
    .lean<LeanTrainee[]>();
  return docs.map(serialize);
}

export async function getTrainee(id: string, ownerId: string): Promise<TraineeDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Trainee.findOne({ _id: id, commanderId: ownerId }).lean<LeanTrainee | null>();
  return doc ? serialize(doc) : null;
}

export async function createTrainee(input: TraineeInput, ownerId: string): Promise<TraineeDTO> {
  await connectToDatabase();
  const doc = await Trainee.create({ ...input, commanderId: ownerId });
  return serialize(doc.toObject() as LeanTrainee);
}

export async function updateTrainee(
  id: string,
  patch: Partial<TraineeInput>,
  ownerId: string,
): Promise<TraineeDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectToDatabase();
  const doc = await Trainee.findOneAndUpdate(
    { _id: id, commanderId: ownerId },
    { $set: patch },
    { new: true, runValidators: true },
  ).lean<LeanTrainee | null>();
  return doc ? serialize(doc) : null;
}

export async function deleteTrainee(id: string, ownerId: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await connectToDatabase();
  const res = await Trainee.findOneAndDelete({ _id: id, commanderId: ownerId }).lean<LeanTrainee | null>();
  return Boolean(res);
}
