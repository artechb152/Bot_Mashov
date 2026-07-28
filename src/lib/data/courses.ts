import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Course } from "@/models";
import { COURSE_LABELS, COURSE_TYPES, isCourseType, type CourseType } from "@/lib/domain/types";

/**
 * Course service. `Course.code` IS the CourseType enum value, so courseType and
 * courseId map deterministically. Courses are fixed (the two the product serves),
 * so the type↔id maps are memoized per process — they never change once seeded.
 *
 * Server-only.
 */

export type CourseDTO = {
  id: string;
  code: CourseType;
  name: string;
  isActive: boolean;
};

type LeanCourse = {
  _id: unknown;
  code?: string;
  name?: string;
  isActive?: boolean;
};

function serializeCourse(doc: LeanCourse): CourseDTO {
  return {
    id: String(doc._id),
    code: isCourseType(doc.code) ? doc.code : "kapeh",
    name: doc.name ?? "",
    isActive: doc.isActive !== false,
  };
}

/**
 * Idempotently ensure both courses exist. `upsert + $setOnInsert` keyed on the
 * unique `code` → running it repeatedly never creates duplicates and never resets
 * an existing course's name/isActive. Safe to call at seed/backfill time.
 */
export async function ensureCourses(): Promise<void> {
  await connectToDatabase();
  for (const code of COURSE_TYPES) {
    await Course.updateOne(
      { code },
      { $setOnInsert: { code, name: COURSE_LABELS[code], isActive: true } },
      { upsert: true },
    );
  }
}

const typeToId = new Map<CourseType, string>();
const idToType = new Map<string, CourseType>();

async function primeCourseMaps(): Promise<void> {
  if (typeToId.size >= COURSE_TYPES.length) return;
  await connectToDatabase();
  const docs = await Course.find({}).select("_id code").lean<LeanCourse[]>();
  for (const d of docs) {
    if (isCourseType(d.code)) {
      typeToId.set(d.code, String(d._id));
      idToType.set(String(d._id), d.code);
    }
  }
}

/** Resolve a CourseType → its courseId (null if the course has not been seeded). */
export async function courseIdForType(courseType: CourseType): Promise<string | null> {
  await primeCourseMaps();
  return typeToId.get(courseType) ?? null;
}

/** Resolve a courseId → its CourseType (null if unknown). */
export async function courseTypeForId(courseId: string): Promise<CourseType | null> {
  if (!isValidObjectId(courseId)) return null;
  await primeCourseMaps();
  return idToType.get(String(courseId)) ?? null;
}

export async function listCourses(): Promise<CourseDTO[]> {
  await connectToDatabase();
  const docs = await Course.find({}).sort({ code: 1 }).lean<LeanCourse[]>();
  return docs.map(serializeCourse);
}

export async function getCourse(courseId: string): Promise<CourseDTO | null> {
  if (!isValidObjectId(courseId)) return null;
  await connectToDatabase();
  const doc = await Course.findById(courseId).lean<LeanCourse | null>();
  return doc ? serializeCourse(doc) : null;
}
