/**
 * Course-scope consistency audit — DRY-RUN ONLY. It READS the database and reports
 * anomalies in the courseType → courseId migration; it writes NOTHING, mutates no
 * real data, runs no backfill, and never touches "עידו גרשון" or any account.
 *
 *   npm run check:consistency
 *
 * Reports:
 *   - staff/admin missing courseId
 *   - courseType ↔ courseId mismatch (courseId maps to a different course)
 *   - current-assignment courseId ↔ User.courseId mismatch
 *   - super_admin / root carrying a course (should be null)
 *   - staff/admin with no current assignment
 *   - users with more than one current assignment
 *   - orphan current assignments (unknown user or unknown course)
 *
 * Exit code is always 0 — this is a report, not a gate.
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Course, User, UserAssignment } from "@/models";
import { isCourseType, isUserRole, type UserRole } from "@/lib/domain/types";

loadEnvConfig(process.cwd());

type LeanUser = {
  _id: unknown;
  username?: string;
  role?: string | null;
  isRootSuperAdmin?: boolean | null;
  courseType?: string | null;
  courseId?: unknown;
};

type LeanCurrent = { _id: unknown; userId?: unknown; courseId?: unknown };

function section(title: string, rows: string[]): void {
  console.log(`\n${rows.length === 0 ? "✓" : "⚠"} ${title}: ${rows.length}`);
  for (const r of rows.slice(0, 20)) console.log(`    - ${r}`);
  if (rows.length > 20) console.log(`    … ועוד ${rows.length - 20}`);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("[consistency] חסר MONGODB_URI ב-.env.local.");
    process.exit(1);
  }
  await connectToDatabase();
  console.log("\n=== consistency audit (DRY-RUN — reads only, writes nothing) ===");

  const courses = await Course.find({}).select("_id code").lean<{ _id: unknown; code?: string }[]>();
  const idToType = new Map<string, string>();
  const courseIds = new Set<string>();
  for (const c of courses) {
    courseIds.add(String(c._id));
    if (isCourseType(c.code)) idToType.set(String(c._id), c.code);
  }

  const users = await User.find({})
    .select("_id username role isRootSuperAdmin courseType courseId")
    .lean<LeanUser[]>();
  const userIds = new Set(users.map((u) => String(u._id)));

  const currents = await UserAssignment.find({ isCurrent: true })
    .select("_id userId courseId")
    .lean<LeanCurrent[]>();
  const currentByUser = new Map<string, string[]>();
  for (const a of currents) {
    const uid = a.userId ? String(a.userId) : "";
    const list = currentByUser.get(uid) ?? [];
    list.push(a.courseId ? String(a.courseId) : "");
    currentByUser.set(uid, list);
  }

  const missingCourseId: string[] = [];
  const typeIdMismatch: string[] = [];
  const assignmentMismatch: string[] = [];
  const globalHasCourse: string[] = [];
  const noCurrentAssignment: string[] = [];
  const multipleCurrent: string[] = [];

  for (const u of users) {
    const uid = String(u._id);
    const name = u.username ?? uid;
    const role: UserRole = isUserRole(u.role) ? u.role : "staff";
    const courseId = u.courseId ? String(u.courseId) : null;
    const courseType = u.courseType ?? null;
    const isRoot = u.isRootSuperAdmin === true;
    const cur = currentByUser.get(uid) ?? [];

    if (role === "super_admin" || isRoot) {
      if (courseId || courseType) {
        globalHasCourse.push(`${name} (${isRoot ? "root" : "super_admin"}) courseId=${courseId ?? "—"} courseType=${courseType ?? "—"}`);
      }
      continue; // global tier — no assignment expected
    }

    // staff / admin
    if (!courseId) missingCourseId.push(`${name} (${role}) courseType=${courseType ?? "—"}`);
    if (courseId && courseType) {
      const mapped = idToType.get(courseId);
      if (mapped && mapped !== courseType) {
        typeIdMismatch.push(`${name} (${role}) courseType=${courseType} but courseId→${mapped}`);
      }
    }
    if (cur.length === 0) noCurrentAssignment.push(`${name} (${role})`);
    if (cur.length > 1) multipleCurrent.push(`${name} (${role}) ×${cur.length}`);
    if (cur.length === 1 && courseId && cur[0] && cur[0] !== courseId) {
      assignmentMismatch.push(`${name} (${role}) User.courseId=${courseId} but current assignment courseId=${cur[0]}`);
    }
  }

  const orphanAssignments: string[] = [];
  for (const a of currents) {
    const uid = a.userId ? String(a.userId) : "";
    const cid = a.courseId ? String(a.courseId) : "";
    if (!userIds.has(uid)) orphanAssignments.push(`assignment ${String(a._id)} → unknown user ${uid || "—"}`);
    else if (!courseIds.has(cid)) orphanAssignments.push(`assignment ${String(a._id)} → unknown course ${cid || "—"}`);
  }

  console.log(`\nscanned: users=${users.length} currentAssignments=${currents.length} courses=${courses.length}`);
  section("staff/admin missing courseId", missingCourseId);
  section("courseType ↔ courseId mismatch", typeIdMismatch);
  section("current-assignment ↔ User.courseId mismatch", assignmentMismatch);
  section("super_admin/root carrying a course (should be null)", globalHasCourse);
  section("staff/admin with no current assignment", noCurrentAssignment);
  section("users with multiple current assignments", multipleCurrent);
  section("orphan current assignments", orphanAssignments);

  const total =
    missingCourseId.length +
    typeIdMismatch.length +
    assignmentMismatch.length +
    globalHasCourse.length +
    noCurrentAssignment.length +
    multipleCurrent.length +
    orphanAssignments.length;
  console.log(`\n=== ${total === 0 ? "clean — no anomalies" : `${total} anomalies (dry-run — nothing changed)`} ===\n`);
}

main()
  .then(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("[consistency] failed:", err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
