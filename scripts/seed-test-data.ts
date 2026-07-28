/**
 * DEVELOPMENT-ONLY test-data seed. Creates clearly-marked local test users across
 * every authorization level so each role can be manually exercised.
 *
 * Guards (both required): NODE_ENV must NOT be "production" AND
 * SEED_TEST_DATA_CONFIRM=yes. It is a local script only — never an API/website
 * route, and must never run against a production database.
 *
 * Run:  SEED_TEST_DATA_CONFIRM=yes npm run dev:seed-test-data
 *
 * Behaviour:
 *   - Ensures the two courses + a test cohort + teams (idempotent).
 *   - Creates stable-username test users; passwords are RANDOM per run (never
 *     hardcoded, never committed). The two root accounts are created as normal
 *     users, then promoted via the SAME protected bootstrap logic (promoteToRoot).
 *   - Only ever touches the known "*.test" usernames — real users are never
 *     modified.
 *   - Prints the credentials once, and writes them to the gitignored
 *     .local/test-credentials.json.
 */
import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { Cohort, Team, User } from "@/models";
import { hashPassword } from "@/lib/auth/password";
import { normalizeUsername } from "@/lib/auth/username";
import { ensureCourses, courseIdForType } from "@/lib/data/courses";
import { ensureCurrentAssignment } from "@/lib/data/assignments";
import { promoteToRoot } from "./promote-root";
import { ADMIN_POSITION_LABELS, COURSE_LABELS, type AdminPosition, type CourseType } from "@/lib/domain/types";

loadEnvConfig(process.cwd());

function randomPassword(): string {
  // 12 url-safe chars — strong, readable, well above the 6-char minimum.
  return randomBytes(9).toString("base64url");
}

const TEAM_NAMES = ["צוות 1", "צוות 2"];
const COHORT_CODE = "test-2026";

type Spec = {
  username: string;
  displayName: string;
  kind: "root_hidden" | "root_visible" | "super" | "admin" | "staff";
  course?: CourseType;
  adminPosition?: AdminPosition;
  teamIndex?: number;
};

const SPECS: Spec[] = [
  { username: "owner.root.test", displayName: "בעל המערכת (פרויקט)", kind: "root_hidden" },
  { username: "commander.root.test", displayName: "מפקד בית הספר", kind: "root_visible" },
  { username: "superadmin.test", displayName: "מנהל־על", kind: "super" },
  { username: "admin.kapeh.test", displayName: 'מק"ס קפ"ה', kind: "admin", course: "kapeh", adminPosition: "course_commander" },
  { username: "admin.maksim.test", displayName: 'סמק"ס מק"סים', kind: "admin", course: "maksim", adminPosition: "deputy_course_commander" },
  { username: "staff.kapeh.1.test", displayName: "סגל קפ״ה — צוות 1", kind: "staff", course: "kapeh", teamIndex: 0 },
  { username: "staff.kapeh.2.test", displayName: "סגל קפ״ה — צוות 2", kind: "staff", course: "kapeh", teamIndex: 1 },
  { username: "staff.maksim.1.test", displayName: "סגל מק״סים — צוות 1", kind: "staff", course: "maksim", teamIndex: 0 },
  { username: "staff.maksim.2.test", displayName: "סגל מק״סים — צוות 2", kind: "staff", course: "maksim", teamIndex: 1 },
];

type OrgIds = { courseId: string; cohortId: string; teamIds: string[] };

async function ensureCohort(courseId: string): Promise<string> {
  await Cohort.updateOne(
    { courseId: new Types.ObjectId(courseId), code: COHORT_CODE },
    {
      $setOnInsert: {
        courseId: new Types.ObjectId(courseId),
        code: COHORT_CODE,
        name: "מחזור מבחן 2026",
        status: "active",
        isLocked: false,
      },
    },
    { upsert: true },
  );
  const c = await Cohort.findOne({ courseId: new Types.ObjectId(courseId), code: COHORT_CODE }).select("_id").lean();
  return String((c as { _id: unknown })._id);
}

async function ensureTeams(courseId: string, cohortId: string): Promise<string[]> {
  const ids: string[] = [];
  for (const name of TEAM_NAMES) {
    await Team.updateOne(
      { cohortId: new Types.ObjectId(cohortId), name },
      {
        $setOnInsert: {
          courseId: new Types.ObjectId(courseId),
          cohortId: new Types.ObjectId(cohortId),
          name,
          isActive: true,
        },
      },
      { upsert: true },
    );
    const t = await Team.findOne({ cohortId: new Types.ObjectId(cohortId), name }).select("_id").lean();
    ids.push(String((t as { _id: unknown })._id));
  }
  return ids;
}

type CredRow = {
  username: string;
  displayName: string;
  password: string;
  role: string;
  isRootSuperAdmin: boolean;
  course: string;
  cohort: string;
  team: string;
  adminPosition: string;
};

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("[seed-test] REFUSED: NODE_ENV is production. This seed is for development only.");
    process.exit(1);
  }
  if (process.env.SEED_TEST_DATA_CONFIRM !== "yes") {
    console.error("[seed-test] REFUSED: set SEED_TEST_DATA_CONFIRM=yes to run.");
    console.error("  e.g.  SEED_TEST_DATA_CONFIRM=yes npm run dev:seed-test-data");
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("[seed-test] חסר MONGODB_URI ב-.env.local.");
    process.exit(1);
  }

  await connectToDatabase();
  console.log(`[seed-test] DB: ${mongoose.connection.db?.databaseName}`);

  // Ensure org scaffolding (idempotent, non-destructive).
  await ensureCourses();
  const org: Record<CourseType, OrgIds> = {} as Record<CourseType, OrgIds>;
  for (const code of ["kapeh", "maksim"] as CourseType[]) {
    const courseId = await courseIdForType(code);
    if (!courseId) throw new Error(`course ${code} missing after ensureCourses`);
    const cohortId = await ensureCohort(courseId);
    const teamIds = await ensureTeams(courseId, cohortId);
    org[code] = { courseId, cohortId, teamIds };
  }

  const creds: CredRow[] = [];

  for (const spec of SPECS) {
    const password = randomPassword();
    const passwordHash = await hashPassword(password);
    const isStaff = spec.kind === "staff";
    const isAdmin = spec.kind === "admin";
    const course = spec.course ?? null;
    const courseId = course ? org[course].courseId : null;

    // Base upsert — only ever targets the known *.test username.
    const set: Record<string, unknown> = {
      displayName: spec.displayName,
      fullName: spec.displayName,
      normalizedUsername: normalizeUsername(spec.username),
      passwordHash,
      status: "active",
      onboardingStatus: "complete",
      role: spec.kind === "super" ? "super_admin" : isAdmin ? "admin" : "staff",
      directoryVisibility: "visible",
    };
    if (course) set.courseType = course;
    if (courseId) set.courseId = new Types.ObjectId(courseId);
    if (isAdmin && spec.adminPosition) set.adminPosition = spec.adminPosition;

    const doc = await User.findOneAndUpdate(
      { username: spec.username },
      { $set: set },
      { upsert: true, new: true },
    );
    const userId = String(doc._id);

    // Root accounts: created as normal above, then promoted via the SAME protected
    // bootstrap logic (the only path that ever creates a root).
    let isRoot = false;
    if (spec.kind === "root_hidden" || spec.kind === "root_visible") {
      const visibility = spec.kind === "root_hidden" ? "hidden" : "visible";
      const rootProfile = spec.kind === "root_hidden" ? "platform_owner" : "school_commander";
      const r = await promoteToRoot({ userId }, { visibility, rootProfile });
      isRoot = r.ok;
    }

    // Assignments for admins (course_admin) and staff (staff_team).
    let cohortLabel = "—";
    let teamLabel = "—";
    if (isAdmin && course) {
      await ensureCurrentAssignment(userId, userId, {
        courseId: org[course].courseId,
        cohortId: org[course].cohortId,
        assignmentType: "course_admin",
        role: "admin",
        adminPosition: spec.adminPosition,
      });
      cohortLabel = "מחזור מבחן 2026";
    } else if (isStaff && course && spec.teamIndex !== undefined) {
      const teamId = org[course].teamIds[spec.teamIndex];
      await ensureCurrentAssignment(userId, userId, {
        courseId: org[course].courseId,
        cohortId: org[course].cohortId,
        teamId,
        assignmentType: "staff_team",
        role: "staff",
      });
      cohortLabel = "מחזור מבחן 2026";
      teamLabel = TEAM_NAMES[spec.teamIndex];
    }

    creds.push({
      username: spec.username,
      displayName: spec.displayName,
      password,
      role: spec.kind === "super" ? "super_admin" : isRoot ? "super_admin (root)" : isAdmin ? "admin" : "staff",
      isRootSuperAdmin: isRoot,
      course: course ? COURSE_LABELS[course] : "—",
      cohort: cohortLabel,
      team: teamLabel,
      adminPosition: isAdmin && spec.adminPosition ? ADMIN_POSITION_LABELS[spec.adminPosition] : "—",
    });
  }

  // Write the gitignored credential file.
  const dir = join(process.cwd(), ".local");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, "test-credentials.json");
  writeFileSync(
    outPath,
    JSON.stringify({ generatedAt: new Date().toISOString(), note: "DEV TEST ONLY — do not commit", users: creds }, null, 2),
    "utf8",
  );

  // Print once.
  console.log("\n=================  TEST CREDENTIALS (dev only)  =================\n");
  for (const c of creds) {
    console.log(`• ${c.displayName}`);
    console.log(`    username : ${c.username}`);
    console.log(`    password : ${c.password}`);
    console.log(`    role     : ${c.role}${c.isRootSuperAdmin ? "  👑" : ""}`);
    console.log(`    course   : ${c.course}   cohort: ${c.cohort}   team: ${c.team}   position: ${c.adminPosition}`);
    console.log("");
  }
  console.log(`Saved to: ${outPath}  (gitignored)`);
  console.log("================================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-test] failed:", err);
  process.exit(1);
});
