/**
 * Controlled reset of USERS and TRAINEES. **Dry-run by default — deletes NOTHING**
 * unless BOTH `--confirm` is passed AND `RESET_CONFIRM=yes` is set. Even then it
 * refuses to run if any protection guard fails.
 *
 * What the destructive phase (later, after explicit approval) will do:
 *   - delete ALL trainees and everything owned by a trainee (feedback, AI
 *     conversations/turns/insights, attachments, access grants);
 *   - delete ALL users EXCEPT the two protected ROOT accounts;
 *   - delete the deleted-users' assignments + personal notifications, and the
 *     deprecated messaging/requests collections (to avoid orphaned references).
 *
 * What it NEVER touches: Courses, Cohorts, Teams, Access Codes (AdminInvite),
 * Audit Log, AI knowledge files, application/system config, and the two protected
 * accounts. RBAC (roles / requireSuperAdmin / rootProfile) is not modified.
 *
 * The two protected accounts are identified from the DB by (isRootSuperAdmin +
 * rootProfile) — NEVER by a hard-coded username. If either is missing, ambiguous,
 * or not active, the script ABORTS and deletes nothing (no dangerous fallback).
 *
 * A full JSON backup of every affected collection is written to a gitignored path
 * BEFORE anything is deleted (and during a dry-run too). Password hashes / tokens
 * may be inside the backup (needed to restore) but are NEVER printed.
 *
 * Run (safe):        npx tsx scripts/reset-users-and-trainees.ts --dry-run
 * Run (DESTRUCTIVE): RESET_CONFIRM=yes npx tsx scripts/reset-users-and-trainees.ts --confirm
 */
import { loadEnvConfig } from "@next/env";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import {
  User,
  Trainee,
  Feedback,
  TraineeAttachment,
  TraineeAIInsight,
  TraineeAccessGrant,
  AssistantConversation,
  AssistantTurn,
  UserAssignment,
  Notification,
  InternalMessage,
  InternalMessageThread,
  ThreadParticipantState,
  MessageAttachment,
  MessageDraft,
  AccessRequest,
  FinalExercise,
  AuditLog,
  Cohort,
  Team,
  AdminInvite,
  Course,
} from "@/models";

loadEnvConfig(process.cwd());

/* ------------------------------------------------------------------ helpers */

class AbortReset extends Error {}
const abort = (msg: string): never => {
  throw new AbortReset(msg);
};

const isDestructive = process.argv.includes("--confirm") && process.env.RESET_CONFIRM === "yes";

type LeanUser = {
  _id: unknown;
  username?: string;
  displayName?: string;
  fullName?: string;
  role?: string;
  isRootSuperAdmin?: boolean;
  rootProfile?: string | null;
  status?: string;
  courseType?: string | null;
  defaultCohortId?: unknown;
};

const idStr = (v: unknown): string => String(v);

function ts(): string {
  // Stable, filename-safe timestamp (this is a plain tsx script; Date is available).
  return new Date().toISOString().replace(/[:.]/g, "-");
}

/* ------------------------------------------------------------------- main */

async function main(): Promise<void> {
  console.log("\n=== reset-users-and-trainees ===");
  console.log(isDestructive ? "MODE: ⚠ DESTRUCTIVE (will delete)" : "MODE: dry-run (no deletions)");

  await connectToDatabase();
  const conn = mongoose.connection;
  const dbName = conn.name ?? "(unknown)";
  const host = conn.host ?? "(unknown host)";
  console.log(`\nDB: "${dbName}" on host ${host} (driver: mongoose ${mongoose.version})`);

  /* --- 1. Identify the two protected ROOT accounts (never by username) ----- */
  const roots = await User.find({ isRootSuperAdmin: true }).lean<LeanUser[]>();
  const owners = roots.filter((r) => r.rootProfile === "platform_owner");
  const commanders = roots.filter((r) => r.rootProfile === "school_commander");

  if (owners.length === 0) abort("owner.root (rootProfile=platform_owner, isRootSuperAdmin) NOT found. Aborting.");
  if (owners.length > 1) abort(`Ambiguous: ${owners.length} platform_owner root accounts found. Aborting.`);
  if (commanders.length === 0) abort("School-commander root (rootProfile=school_commander, isRootSuperAdmin) NOT found. Aborting.");
  if (commanders.length > 1) abort(`Ambiguous: ${commanders.length} school_commander root accounts found. Aborting.`);

  const owner = owners[0];
  const commander = commanders[0];

  for (const [label, u] of [["owner.root", owner], ["school_commander", commander]] as const) {
    if (u.role !== "super_admin") abort(`${label} has role "${u.role}" (expected super_admin). Aborting.`);
    if (u.status !== "active") abort(`${label} is not active (status="${u.status}"). Aborting (abnormal state).`);
  }

  const protectedIds = new Set([idStr(owner._id), idStr(commander._id)]);

  console.log("\n--- protected accounts (WILL REMAIN) ---");
  for (const [label, u] of [["owner.root", owner], ["school_commander", commander]] as const) {
    console.log(
      `  • ${label}: id=${idStr(u._id)} username="${u.username}" name="${u.displayName ?? u.fullName ?? ""}" ` +
        `role=${u.role} isRootSuperAdmin=${u.isRootSuperAdmin} rootProfile=${u.rootProfile} status=${u.status}`,
    );
  }

  /* --- 2. Users to delete ------------------------------------------------- */
  const allUsers = await User.find({}).lean<LeanUser[]>();
  const usersToDelete = allUsers.filter((u) => !protectedIds.has(idStr(u._id)));
  const delUserIds = usersToDelete.map((u) => u._id);

  // Guard: a protected account must NEVER be in the delete set.
  if (usersToDelete.some((u) => protectedIds.has(idStr(u._id)))) abort("A protected account is in the delete set. Aborting.");

  /* --- 3. Counts of everything that will be deleted ----------------------- */
  const [
    trainees,
    feedback,
    conversations,
    turns,
    insights,
    traineeAttachments,
    accessGrants,
    finalExercises,
    internalMessages,
    threads,
    participantStates,
    messageAttachments,
    drafts,
    accessRequests,
  ] = await Promise.all([
    Trainee.countDocuments({}),
    Feedback.countDocuments({}),
    AssistantConversation.countDocuments({}),
    AssistantTurn.countDocuments({}),
    TraineeAIInsight.countDocuments({}),
    TraineeAttachment.countDocuments({}),
    TraineeAccessGrant.countDocuments({}),
    FinalExercise.countDocuments({}),
    InternalMessage.countDocuments({}),
    InternalMessageThread.countDocuments({}),
    ThreadParticipantState.countDocuments({}),
    MessageAttachment.countDocuments({}),
    MessageDraft.countDocuments({}),
    AccessRequest.countDocuments({}),
  ]);
  const [notifications, assignments] = await Promise.all([
    Notification.countDocuments({ userId: { $in: delUserIds } }),
    UserAssignment.countDocuments({ userId: { $in: delUserIds } }),
  ]);

  /* --- 4. Storage objects that the destructive phase would remove --------- */
  const feedbackStorageDocs = await Feedback.find({ "attachment.storageKey": { $exists: true, $ne: "" } })
    .select("attachment.storageKey")
    .lean<{ attachment?: { storageKey?: string } }[]>();
  const traineeSourceDocs = await Trainee.find({ "sourceImport.storageKey": { $exists: true, $ne: "" } })
    .select("sourceImport.storageKey")
    .lean<{ sourceImport?: { storageKey?: string } }[]>();
  const feedbackStorageKeys = feedbackStorageDocs.map((d) => d.attachment?.storageKey).filter(Boolean) as string[];
  const traineeStorageKeys = traineeSourceDocs.map((d) => d.sourceImport?.storageKey).filter(Boolean) as string[];

  /* --- 5. Dangling refs that will remain on KEPT collections (harmless in
   *        Mongo — no FK enforcement — reported for transparency) ---------- */
  const [auditDangling, cohortDangling, teamDangling, inviteDangling] = await Promise.all([
    AuditLog.countDocuments({ actorId: { $in: delUserIds } }),
    Cohort.countDocuments({ $or: [{ createdBy: { $in: delUserIds } }, { updatedBy: { $in: delUserIds } }] }),
    Team.countDocuments({ $or: [{ createdBy: { $in: delUserIds } }, { updatedBy: { $in: delUserIds } }] }),
    AdminInvite.countDocuments({
      $or: [{ createdBy: { $in: delUserIds } }, { usedBy: { $in: delUserIds } }, { revokedBy: { $in: delUserIds } }],
    }),
  ]);

  /* --- 6. Kept-collection sanity counts ----------------------------------- */
  const [courses, cohorts, teams, invites, audits] = await Promise.all([
    Course.countDocuments({}),
    Cohort.countDocuments({}),
    Team.countDocuments({}),
    AdminInvite.countDocuments({}),
    AuditLog.countDocuments({}),
  ]);

  /* --- 7. BACKUP (always — dry-run and destructive) ----------------------- */
  const backupDir = path.join(process.cwd(), ".local", "backup", `reset-${ts()}`);
  mkdirSync(backupDir, { recursive: true });

  type DumpModel = { find(q: object): { lean(): Promise<unknown[]> } };
  const dump = async (name: string, model: DumpModel, q: object = {}) => {
    const docs = await model.find(q).lean();
    writeFileSync(path.join(backupDir, `${name}.json`), JSON.stringify(docs, null, 0));
    return docs.length;
  };
  const m = (model: unknown): DumpModel => model as DumpModel;

  const backupCounts: Record<string, number> = {};
  // Full snapshot of every affected collection + the kept org (for a clean restore).
  backupCounts.users = await dump("users", m(User));
  backupCounts.trainees = await dump("trainees", m(Trainee));
  backupCounts.feedback = await dump("feedback", m(Feedback));
  backupCounts.assistant_conversations = await dump("assistant_conversations", m(AssistantConversation));
  backupCounts.assistant_turns = await dump("assistant_turns", m(AssistantTurn));
  backupCounts.trainee_ai_insights = await dump("trainee_ai_insights", m(TraineeAIInsight));
  backupCounts.trainee_attachments = await dump("trainee_attachments", m(TraineeAttachment));
  backupCounts.trainee_access_grants = await dump("trainee_access_grants", m(TraineeAccessGrant));
  backupCounts.user_assignments = await dump("user_assignments", m(UserAssignment));
  backupCounts.notifications = await dump("notifications", m(Notification));
  backupCounts.internal_message_threads = await dump("internal_message_threads", m(InternalMessageThread));
  backupCounts.internal_messages = await dump("internal_messages", m(InternalMessage));
  backupCounts.thread_participant_states = await dump("thread_participant_states", m(ThreadParticipantState));
  backupCounts.message_attachments = await dump("message_attachments", m(MessageAttachment));
  backupCounts.message_drafts = await dump("message_drafts", m(MessageDraft));
  backupCounts.access_requests = await dump("access_requests", m(AccessRequest));
  backupCounts.final_exercises = await dump("final_exercises", m(FinalExercise));
  backupCounts.audit_logs = await dump("audit_logs", m(AuditLog));
  // Kept org — snapshotted for reference/restore safety (NOT deleted).
  backupCounts.courses = await dump("courses", m(Course));
  backupCounts.cohorts = await dump("cohorts", m(Cohort));
  backupCounts.teams = await dump("teams", m(Team));
  backupCounts.admin_invites = await dump("admin_invites", m(AdminInvite));

  // Machine-readable plan (full deleted-users list lives here, not truncated).
  const plan = {
    generatedAt: new Date().toISOString(),
    db: dbName,
    protected: [owner, commander].map((u) => ({
      id: idStr(u._id),
      username: u.username,
      role: u.role,
      isRootSuperAdmin: u.isRootSuperAdmin,
      rootProfile: u.rootProfile,
      status: u.status,
    })),
    usersToDelete: usersToDelete.map((u) => ({
      id: idStr(u._id),
      username: u.username,
      displayName: u.displayName ?? u.fullName ?? "",
      role: u.role,
      courseType: u.courseType ?? null,
      defaultCohortId: u.defaultCohortId ? idStr(u.defaultCohortId) : null,
    })),
    counts: {
      trainees, feedback, conversations, turns, insights, traineeAttachments, accessGrants,
      finalExercises, internalMessages, threads, participantStates, messageAttachments, drafts,
      accessRequests, notifications, assignments, usersToDelete: usersToDelete.length,
    },
    storageToDelete: { feedbackStorageKeys, traineeStorageKeys },
    keptCollections: { courses, cohorts, teams, invites, audits },
    danglingAfter: { auditDangling, cohortDangling, teamDangling, inviteDangling },
  };
  writeFileSync(path.join(backupDir, "dry-run-plan.json"), JSON.stringify(plan, null, 2));

  /* --- 8. Report ---------------------------------------------------------- */
  console.log(`\nbackup written to: ${backupDir}`);
  console.log("  backup collection counts:");
  for (const [k, v] of Object.entries(backupCounts)) console.log(`    ${k}: ${v}`);

  console.log(`\n--- users to DELETE (${usersToDelete.length}) ---`);
  const shown = usersToDelete.slice(0, 50);
  for (const u of shown) {
    console.log(
      `  • id=${idStr(u._id)} name="${u.displayName ?? u.fullName ?? ""}" username="${u.username}" ` +
        `role=${u.role} course=${u.courseType ?? "—"}`,
    );
  }
  if (usersToDelete.length > shown.length) console.log(`  … +${usersToDelete.length - shown.length} more (full list in dry-run-plan.json)`);

  console.log("\n--- dependent records that WILL be deleted ---");
  console.log(`  trainees:               ${trainees}`);
  console.log(`  feedback:               ${feedback}`);
  console.log(`  assistant conversations:${conversations}`);
  console.log(`  assistant turns:        ${turns}`);
  console.log(`  trainee AI insights:    ${insights}`);
  console.log(`  trainee attachments:    ${traineeAttachments}  (binary in Mongo)`);
  console.log(`  trainee access grants:  ${accessGrants}`);
  console.log(`  notifications (deleted users): ${notifications}`);
  console.log(`  user assignments (deleted users): ${assignments}`);
  console.log(`  [deprecated] internal messages: ${internalMessages}, threads: ${threads}, participant-states: ${participantStates}, message attachments: ${messageAttachments}, drafts: ${drafts}`);
  console.log(`  [deprecated] access requests:   ${accessRequests}`);
  console.log(`  [deprecated] final exercises:   ${finalExercises}`);

  console.log("\n--- storage objects the DESTRUCTIVE phase would remove (NOT now) ---");
  console.log(`  feedback attachment files (FileStorage): ${feedbackStorageKeys.length}`);
  console.log(`  trainee source-import files (FileStorage): ${traineeStorageKeys.length}`);
  console.log(`  (TraineeAttachment/MessageAttachment binaries are inside Mongo — removed with their docs, no external files)`);

  console.log("\n--- will NOT be deleted (kept) ---");
  console.log(`  courses: ${courses}   cohorts: ${cohorts}   teams: ${teams}   access codes (AdminInvite): ${invites}   audit logs: ${audits}`);
  console.log("  also kept: KnowledgeDocument, Scenario, Simulation, system config, both protected accounts.");

  console.log("\n--- dangling refs that remain on KEPT collections (harmless — Mongo has no FK enforcement) ---");
  console.log(`  audit logs with deleted actorId: ${auditDangling} (kept per instruction)`);
  console.log(`  cohorts with deleted createdBy/updatedBy: ${cohortDangling}`);
  console.log(`  teams with deleted createdBy/updatedBy: ${teamDangling}`);
  console.log(`  access codes with deleted createdBy/usedBy/revokedBy: ${inviteDangling}`);

  /* --- 9. Destructive phase (guarded) ------------------------------------- */
  if (!isDestructive) {
    console.log("\n✓ DRY-RUN complete. Nothing was deleted. Backup created.");
    console.log("  To actually delete (after approval), run:");
    console.log("    RESET_CONFIRM=yes npx tsx scripts/reset-users-and-trainees.ts --confirm");
    return;
  }

  // Final guards before any write.
  if (protectedIds.size !== 2) abort("Protected set is not exactly 2 accounts. Aborting.");

  console.log("\n⚠ Executing destructive deletion…");
  // Trainee-scoped (all trainees are being removed).
  await Feedback.deleteMany({});
  await AssistantTurn.deleteMany({});
  await AssistantConversation.deleteMany({});
  await TraineeAIInsight.deleteMany({});
  await TraineeAttachment.deleteMany({});
  await TraineeAccessGrant.deleteMany({});
  await FinalExercise.deleteMany({});
  await Trainee.deleteMany({});
  // Deprecated messaging/requests (removed entirely to avoid orphans).
  await MessageAttachment.deleteMany({});
  await InternalMessage.deleteMany({});
  await ThreadParticipantState.deleteMany({});
  await MessageDraft.deleteMany({});
  await InternalMessageThread.deleteMany({});
  await AccessRequest.deleteMany({});
  // Deleted-users' personal data.
  await Notification.deleteMany({ userId: { $in: delUserIds } });
  await UserAssignment.deleteMany({ userId: { $in: delUserIds } });
  // Finally, the users themselves (protected accounts excluded).
  await User.deleteMany({ _id: { $in: delUserIds } });

  console.log("✓ Destructive deletion complete. Storage-file cleanup is a separate step.");
}

main()
  .catch((err) => {
    if (err instanceof AbortReset) {
      console.error(`\n✗ ABORTED (no deletion, guard tripped): ${err.message}`);
      process.exit(2);
    }
    console.error("\n✗ reset script failed:", err);
    process.exit(1);
  })
  .finally(() => {
    void mongoose.connection.close();
  });
