/**
 * DEVELOPMENT-ONLY communication test data: message threads, drafts, access
 * requests, a trainee-access grant, and the notifications they emit. Additive and
 * idempotent — it never resets data, never alters the real user, and NEVER
 * regenerates test-user passwords (it only reads the existing test users).
 *
 * Prerequisite: run `dev:seed-test-data` first (this script does NOT create users).
 *
 * Guards (both required): NODE_ENV must NOT be "production" AND
 * SEED_COMMUNICATION_CONFIRM=yes.
 *
 * Run:  SEED_COMMUNICATION_CONFIRM=yes npm run dev:seed-communication-data
 */
import { loadEnvConfig } from "@next/env";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { AccessRequest, InternalMessageThread, MessageDraft, Trainee, User, UserAssignment } from "@/models";
import type { Account } from "@/lib/auth/account";
import { createThread, saveDraft, setThreadArchived } from "@/lib/data/messages";
import { createRequest, approveRequest, rejectRequest } from "@/lib/data/requests";
import type { CourseType } from "@/lib/domain/types";

loadEnvConfig(process.cwd());

const MARK = "[הדגמה]";

type LeanUser = {
  _id: unknown;
  username?: string;
  displayName?: string;
  role?: string;
  courseType?: string;
  courseId?: unknown;
  isRootSuperAdmin?: boolean;
  rootProfile?: string;
  status?: string;
  adminPosition?: string;
  directoryVisibility?: string;
};

function accountFor(u: LeanUser): Account {
  return {
    id: String(u._id),
    username: u.username || "",
    courseType: (u.courseType as CourseType) ?? null,
    courseId: u.courseId ? String(u.courseId) : null,
    role: (u.role as Account["role"]) ?? "staff",
    isRootSuperAdmin: u.isRootSuperAdmin === true,
    rootProfile: (u.rootProfile as Account["rootProfile"]) ?? null,
    status: (u.status as Account["status"]) ?? "active",
    adminPosition: (u.adminPosition as Account["adminPosition"]) ?? null,
    directoryVisibility: (u.directoryVisibility as Account["directoryVisibility"]) ?? "visible",
  };
}

async function findUser(username: string): Promise<LeanUser | null> {
  return User.findOne({ username })
    .select("_id username displayName role courseType courseId isRootSuperAdmin status adminPosition directoryVisibility")
    .lean<LeanUser | null>();
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("[seed-comm] REFUSED: NODE_ENV is production.");
    process.exit(1);
  }
  if (process.env.SEED_COMMUNICATION_CONFIRM !== "yes") {
    console.error("[seed-comm] REFUSED: set SEED_COMMUNICATION_CONFIRM=yes to run.");
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error("[seed-comm] חסר MONGODB_URI ב-.env.local.");
    process.exit(1);
  }
  await connectToDatabase();
  console.log(`[seed-comm] DB: ${mongoose.connection.db?.databaseName}`);

  const usernames = [
    "staff.kapeh.1.test",
    "staff.kapeh.2.test",
    "admin.kapeh.test",
    "superadmin.test",
  ];
  const users: Record<string, LeanUser> = {};
  for (const un of usernames) {
    const u = await findUser(un);
    if (!u) {
      console.error(`[seed-comm] חסר משתמש בדיקה "${un}". הרץ תחילה: npm run dev:seed-test-data`);
      process.exit(1);
    }
    users[un] = u;
  }

  const staff1 = accountFor(users["staff.kapeh.1.test"]);
  const staff2 = accountFor(users["staff.kapeh.2.test"]);
  const adminK = accountFor(users["admin.kapeh.test"]);
  const superA = accountFor(users["superadmin.test"]);

  // Two test trainees owned by staff1 (idempotent), for trainee refs + requests.
  const assignment = await UserAssignment.findOne({ userId: staff1.id, isCurrent: true }).select("cohortId teamId courseId").lean<{ cohortId?: unknown; teamId?: unknown; courseId?: unknown } | null>();
  async function ensureTrainee(name: string): Promise<string> {
    const existing = await Trainee.findOne({ fullName: name, commanderId: new Types.ObjectId(staff1.id) }).select("_id").lean<{ _id: unknown } | null>();
    if (existing) return String(existing._id);
    const owner = new Types.ObjectId(staff1.id);
    const created = await Trainee.create({
      commanderId: owner,
      ownerId: owner,
      originalOwnerId: owner,
      createdBy: owner,
      lastUpdatedBy: owner,
      fullName: name,
      courseType: staff1.courseType,
      courseId: assignment?.courseId ?? (staff1.courseId ? new Types.ObjectId(staff1.courseId) : undefined),
      cohortId: assignment?.cohortId ?? undefined,
      teamId: assignment?.teamId ?? undefined,
      team: "צוות 1",
      status: "active",
      strengths: ["יוזמה"],
      weaknesses: ["ניהול זמן"],
      notes: "חניך הדגמה עבור בדיקות.",
    });
    console.log(`  created demo trainee: ${name}`);
    return String(created._id);
  }
  const traineeId = await ensureTrainee(`${MARK} חניך לדוגמה א׳`);
  const traineeId2 = await ensureTrainee(`${MARK} חניך לדוגמה ב׳`);

  async function threadOnce(subject: string, make: () => Promise<{ ok: boolean; threadId?: string; error?: string }>): Promise<string | null> {
    const existing = await InternalMessageThread.findOne({ subject }).select("_id").lean<{ _id: unknown } | null>();
    if (existing) return String(existing._id);
    const res = await make();
    if (!res.ok) {
      console.warn(`  thread "${subject}" skipped: ${res.error}`);
      return null;
    }
    console.log(`  created thread: ${subject}`);
    return res.threadId ?? null;
  }

  // 1) staff → staff (same course), references the trainee (restricted for staff2 until granted).
  await threadOnce(`${MARK} תיאום צוות`, () =>
    createThread(staff1, { subject: `${MARK} תיאום צוות`, body: "היי, בוא נסכם על החניך המשותף.", spec: { userIds: [staff2.id] }, relatedTraineeIds: [traineeId] }),
  );

  // 2) staff → admin, with a small attachment.
  await threadOnce(`${MARK} שאלה למק"ס`, () =>
    createThread(staff1, {
      subject: `${MARK} שאלה למק"ס`,
      body: "מצורף סיכום קצר.",
      spec: { userIds: [adminK.id] },
      files: [{ originalName: "summary.txt", mimeType: "text/plain", size: 20, content: Buffer.from("סיכום הדגמה\n") }],
    }),
  );

  // 3) admin course broadcast.
  await threadOnce(`${MARK} הודעת קורס`, () =>
    createThread(adminK, { subject: `${MARK} הודעת קורס`, body: "עדכון לכלל סגל הקורס.", spec: { groups: [`course:${adminK.courseType}`] } }),
  );

  // 4) super-admin message.
  await threadOnce(`${MARK} הודעת מערכת`, () =>
    createThread(superA, { subject: `${MARK} הודעת מערכת`, body: "הודעה מהנהלת המערכת.", spec: { userIds: [adminK.id] } }),
  );

  // 5) one archived thread (staff2 archives it).
  const archId = await threadOnce(`${MARK} להעברה לארכיון`, () =>
    createThread(staff1, { subject: `${MARK} להעברה לארכיון`, body: "אפשר לארכב.", spec: { userIds: [staff2.id] } }),
  );
  if (archId) await setThreadArchived(staff2.id, archId, true);

  // 6) one draft (staff1).
  const draftSubject = `${MARK} טיוטה`;
  if (!(await MessageDraft.exists({ userId: staff1.id, subject: draftSubject }))) {
    await saveDraft(staff1.id, { subject: draftSubject, body: "טיוטה שטרם נשלחה." });
    console.log("  created draft");
  }

  // --- Access requests ---------------------------------------------------------
  async function requestOnce(requester: Account, reason: string, make: () => Promise<{ ok: boolean; id?: string; reason?: string }>): Promise<string | null> {
    const existing = await AccessRequest.findOne({ requesterId: new Types.ObjectId(requester.id), reason }).select("_id").lean<{ _id: unknown } | null>();
    if (existing) return String(existing._id);
    const res = await make();
    if (!res.ok) {
      console.warn(`  request skipped: ${res.reason}`);
      return null;
    }
    return res.id ?? null;
  }

  // 7) pending trainee_view request for trainee ב׳ (staff2 → kapeh admins).
  await requestOnce(staff2, `${MARK} בקשה ממתינה לצפייה`, () =>
    createRequest(staff2, { requestType: "trainee_view", reason: `${MARK} בקשה ממתינה לצפייה`, targetTraineeId: traineeId2 }),
  );

  // 8) approved trainee_view request for trainee א׳ (the one referenced in the
  //    staff→staff thread) → grant for staff2, so that message ref becomes a link.
  const approvedId = await requestOnce(staff2, `${MARK} בקשה שאושרה לצפייה`, () =>
    createRequest(staff2, { requestType: "trainee_view", reason: `${MARK} בקשה שאושרה לצפייה`, targetTraineeId: traineeId }),
  );
  if (approvedId) {
    const r = await approveRequest(adminK, approvedId, `${MARK} מאושר לצורכי הדגמה`);
    if (r.ok) console.log("  approved trainee_view request → grant created for staff2");
  }

  // 9) rejected team_change request (staff1 → kapeh admins).
  const rejectedId = await requestOnce(staff1, `${MARK} בקשה שנדחתה לשינוי צוות`, () =>
    createRequest(staff1, { requestType: "team_change", reason: `${MARK} בקשה שנדחתה לשינוי צוות`, targetTeamId: undefined }),
  );
  if (rejectedId) {
    const r = await rejectRequest(adminK, rejectedId, `${MARK} נדחה לצורכי הדגמה`);
    if (r.ok) console.log("  rejected team_change request");
  }

  console.log("\n[seed-comm] ✓ communication test data ready (idempotent).\n");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed-comm] failed:", err);
  process.exit(1);
});
