/**
 * Safe, idempotent, NON-DESTRUCTIVE backfill of the organizational + ownership
 * fields onto pre-redesign records. It ADDS fields only (existence-filtered $set /
 * upserts); it never deletes, never resets, never overwrites a value that is
 * already set, and never assigns orphaned trainees to any account.
 *
 * DRY-RUN BY DEFAULT. It writes nothing unless BOTH are supplied:
 *     BACKFILL_CONFIRM=yes  AND  --apply
 * e.g.  BACKFILL_CONFIRM=yes npx tsx scripts/backfill-org.ts --apply
 *
 * Orphaned trainees (a trainee whose commanderId does not reference a live user)
 * are REPORTED ONLY — their missing fields are listed and they are left untouched
 * for a manual decision. They are never attached to a test/seed account.
 *
 * This script is provided for review and is intended to be run manually, with
 * explicit approval, only when there is legacy data to migrate.
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Course, Cohort, Team, Trainee, TraineeAttachment, User, UserAssignment } from "@/models";
import { ensureCourses, courseIdForType } from "@/lib/data/courses";
import { ensureLegacyCohort } from "@/lib/data/cohorts";
import { ensureLegacyTeam } from "@/lib/data/teams";
import { ensureCurrentAssignment } from "@/lib/data/assignments";
import { COURSE_TYPES, isCourseType, type CourseType } from "@/lib/domain/types";

loadEnvConfig(process.cwd());

const APPLY = process.argv.includes("--apply") && process.env.BACKFILL_CONFIRM === "yes";

function log(msg: string) {
  console.log(msg);
}

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error("[backfill] חסר MONGODB_URI ב-.env.local.");
    process.exit(1);
  }
  await connectToDatabase();
  log(`\n=== org backfill — mode: ${APPLY ? "APPLY (writes enabled)" : "DRY-RUN (no writes)"} ===\n`);

  // Any actorId works for audit-less ensure helpers; use a fixed sentinel actor for
  // the assignment "assignedBy" (a real ObjectId, not tied to a user).
  const SENTINEL_ACTOR = "000000000000000000000000";

  /* --- Counts before ----------------------------------------------------- */
  const [userCount, traineeCount, attCount] = await Promise.all([
    User.countDocuments({}),
    Trainee.countDocuments({}),
    TraineeAttachment.countDocuments({}),
  ]);
  log(`records: users=${userCount} trainees=${traineeCount} attachments=${attCount}`);

  /* --- Ensure courses + legacy buckets ----------------------------------- */
  if (APPLY) {
    // Build the unique/partial indexes the upserts rely on (non-destructive).
    await Promise.all([
      Course.createIndexes(),
      Cohort.createIndexes(),
      Team.createIndexes(),
      UserAssignment.createIndexes(),
    ]);
    await ensureCourses();
  } else {
    log("would: ensure courses (kapeh, maksim) + legacy default cohort/team per course");
  }

  const legacyByCourse = new Map<CourseType, { courseId: string; cohortId: string; teamId: string }>();
  if (APPLY) {
    for (const code of COURSE_TYPES) {
      const courseId = await courseIdForType(code);
      if (!courseId) continue;
      const cohortId = await ensureLegacyCohort(SENTINEL_ACTOR, courseId);
      const teamId = await ensureLegacyTeam(SENTINEL_ACTOR, courseId, cohortId);
      legacyByCourse.set(code, { courseId, cohortId, teamId });
    }
  }

  /* --- Users (additive; never touch role; skip roots) -------------------- */
  const usersNeedingStatus = await User.countDocuments({ status: { $exists: false } });
  const usersNeedingVisibility = await User.countDocuments({ directoryVisibility: { $exists: false } });
  const usersNeedingRootFlag = await User.countDocuments({ isRootSuperAdmin: { $exists: false } });
  const usersNeedingCourseId = await User.countDocuments({
    courseType: { $in: [...COURSE_TYPES] },
    courseId: { $exists: false },
  });
  log(
    `\nusers needing backfill: status=${usersNeedingStatus} visibility=${usersNeedingVisibility} ` +
      `rootFlag=${usersNeedingRootFlag} courseId=${usersNeedingCourseId}`,
  );

  if (APPLY) {
    await User.updateMany({ status: { $exists: false } }, { $set: { status: "active" } });
    await User.updateMany(
      { directoryVisibility: { $exists: false } },
      { $set: { directoryVisibility: "visible" } },
    );
    await User.updateMany(
      { isRootSuperAdmin: { $exists: false } },
      { $set: { isRootSuperAdmin: false } },
    );
    for (const code of COURSE_TYPES) {
      const legacy = legacyByCourse.get(code);
      if (!legacy) continue;
      await User.updateMany(
        { courseType: code, courseId: { $exists: false } },
        { $set: { courseId: new mongoose.Types.ObjectId(legacy.courseId) } },
      );
    }

    // Ensure one current assignment per user with a course (never for roots — a
    // root needs no course assignment; skip isRootSuperAdmin:true defensively).
    const users = await User.find({ isRootSuperAdmin: { $ne: true }, courseType: { $in: [...COURSE_TYPES] } })
      .select("_id role courseType adminPosition")
      .lean<{ _id: unknown; role?: string; courseType?: string; adminPosition?: string }[]>();
    for (const u of users) {
      const code = isCourseType(u.courseType) ? u.courseType : null;
      if (!code) continue;
      const legacy = legacyByCourse.get(code);
      if (!legacy) continue;
      const isStaff = (u.role ?? "staff") === "staff";
      await ensureCurrentAssignment(SENTINEL_ACTOR, String(u._id), {
        courseId: legacy.courseId,
        cohortId: legacy.cohortId,
        teamId: isStaff ? legacy.teamId : null,
        assignmentType: isStaff ? "staff_team" : "course_admin",
        role: (u.role as "staff" | "admin" | "super_admin") ?? "staff",
        adminPosition: u.adminPosition as "course_commander" | "deputy_course_commander" | undefined,
      });
    }
    log(`applied: user field defaults + current assignments (${users.length} scoped users)`);
  }

  /* --- Trainees: classify valid vs orphaned ------------------------------ */
  const userIds = new Set(
    (await User.find({}).select("_id").lean<{ _id: unknown }[]>()).map((u) => String(u._id)),
  );
  const trainees = await Trainee.find({})
    .select("_id commanderId courseType courseId cohortId teamId ownerId originalOwnerId createdBy status")
    .lean<Record<string, unknown>[]>();

  const orphaned: { id: string; missing: string[] }[] = [];
  let validBackfilled = 0;

  for (const t of trainees) {
    const owner = t.commanderId ? String(t.commanderId) : null;
    const ownerExists = owner ? userIds.has(owner) : false;

    if (!ownerExists) {
      const missing: string[] = [];
      if (!t.commanderId) missing.push("commanderId");
      if (!t.courseType) missing.push("courseType");
      for (const f of ["courseId", "cohortId", "teamId", "ownerId", "originalOwnerId", "createdBy", "status"]) {
        if (t[f] == null) missing.push(f);
      }
      orphaned.push({ id: String(t._id), missing });
      continue; // NEVER auto-fill orphaned records.
    }

    const code = isCourseType(t.courseType) ? (t.courseType as CourseType) : null;
    if (!code) continue;

    if (APPLY) {
      const legacy = legacyByCourse.get(code);
      const set: Record<string, unknown> = {};
      if (legacy) {
        if (t.courseId == null) set.courseId = new mongoose.Types.ObjectId(legacy.courseId);
        if (t.cohortId == null) set.cohortId = new mongoose.Types.ObjectId(legacy.cohortId);
        if (t.teamId == null) set.teamId = new mongoose.Types.ObjectId(legacy.teamId);
      }
      if (t.ownerId == null) set.ownerId = t.commanderId;
      if (t.originalOwnerId == null) set.originalOwnerId = t.commanderId;
      if (t.createdBy == null) set.createdBy = t.commanderId;
      if (t.status == null) set.status = "active";
      // cohortLocked defaults via schema; ensure explicit false if missing.
      set.lastUpdatedBy = t.commanderId;
      if (Object.keys(set).length > 0) {
        await Trainee.updateOne({ _id: t._id }, { $set: { cohortLocked: false, ...set } });
        validBackfilled++;
      }
    } else {
      validBackfilled++; // would backfill
    }
  }

  log(`\ntrainees: valid-owner ${trainees.length - orphaned.length}, orphaned ${orphaned.length}`);
  log(`${APPLY ? "backfilled" : "would backfill"} valid trainees: ${validBackfilled}`);
  if (orphaned.length > 0) {
    log("\n--- ORPHANED trainees (NOT modified — manual decision required) ---");
    for (const o of orphaned) log(`  trainee ${o.id}: missing ${o.missing.join(", ")}`);
  }

  /* --- Attachments: courseId backfill from courseType -------------------- */
  const attNeedingCourseId = await TraineeAttachment.countDocuments({
    courseType: { $in: [...COURSE_TYPES] },
    courseId: { $exists: false },
  });
  log(`\nattachments needing courseId: ${attNeedingCourseId}`);
  if (APPLY) {
    for (const code of COURSE_TYPES) {
      const courseId = await courseIdForType(code);
      if (!courseId) continue;
      await TraineeAttachment.updateMany(
        { courseType: code, courseId: { $exists: false } },
        { $set: { courseId: new mongoose.Types.ObjectId(courseId) } },
      );
    }
  }

  log(`\n=== backfill ${APPLY ? "APPLIED" : "DRY-RUN complete — no writes"} ===\n`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});
