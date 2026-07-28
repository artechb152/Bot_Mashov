/**
 * Protected root super-admin bootstrap — the ONLY way a root account is ever
 * created. Local maintenance script; NOT exposed through any API or website
 * button. Promotes an EXISTING user (by username or id) to:
 *
 *     role: "super_admin", isRootSuperAdmin: true, status: "active"
 *
 * optionally setting directory visibility (hidden for the project owner, visible
 * for the school commander). It never creates a user, never resets the database,
 * never prints a password hash, is idempotent, and asks for explicit confirmation
 * before writing.
 *
 * Usage:
 *   npm run admin:create-root -- --username "עידו גרשון" --profile school_commander
 *   npm run admin:create-root -- --id 6a56... --profile platform_owner
 *   npm run admin:create-root -- --username commander --visible --yes
 *
 * Flags: --username <name> | --id <objectId> ;
 *        --profile platform_owner|school_commander (sets a sensible default
 *          visibility: platform_owner→hidden, school_commander→visible) ;
 *        --hidden | --visible (override visibility) ; --yes (skip prompt)
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import { isRootProfile, type DirectoryVisibility, type RootProfile } from "@/lib/domain/types";
import { promoteToRoot } from "./promote-root";

loadEnvConfig(process.cwd());

function getFlag(name: string): string | boolean {
  const argv = process.argv.slice(2);
  const i = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (i === -1) return false;
  const arg = argv[i];
  if (arg.includes("=")) return arg.slice(arg.indexOf("=") + 1);
  const next = argv[i + 1];
  if (next && !next.startsWith("--")) return next;
  return true;
}

async function main(): Promise<void> {
  if (!process.env.MONGODB_URI) {
    console.error("[create-root] חסר MONGODB_URI ב-.env.local.");
    process.exit(1);
  }

  const usernameFlag = getFlag("username");
  const idFlag = getFlag("id");
  const username = typeof usernameFlag === "string" ? usernameFlag : undefined;
  const userId = typeof idFlag === "string" ? idFlag : undefined;
  const hidden = getFlag("hidden") === true;
  const visibleFlag = getFlag("visible") === true;
  const skipConfirm = getFlag("yes") === true || getFlag("y") === true;
  const profileFlag = getFlag("profile");

  if (!username && !userId) {
    console.error('[create-root] יש לציין --username "<שם>" או --id <objectId>.');
    process.exit(1);
  }

  let rootProfile: RootProfile | undefined;
  if (typeof profileFlag === "string") {
    if (!isRootProfile(profileFlag)) {
      console.error("[create-root] --profile חייב להיות platform_owner או school_commander.");
      process.exit(1);
    }
    rootProfile = profileFlag;
  }

  // Explicit --hidden/--visible wins; otherwise derive a sensible default from the
  // profile (platform_owner→hidden, school_commander→visible).
  let visibility: DirectoryVisibility | undefined;
  if (hidden) visibility = "hidden";
  else if (visibleFlag) visibility = "visible";
  else if (rootProfile === "platform_owner") visibility = "hidden";
  else if (rootProfile === "school_commander") visibility = "visible";

  await connectToDatabase();

  // Preview (secret-free) before any write.
  const query = userId ? { _id: userId } : { username };
  const preview = await User.find(query)
    .select("_id username displayName role isRootSuperAdmin status directoryVisibility courseType")
    .lean();

  if (preview.length === 0) {
    console.error("[create-root] לא נמצא משתמש תואם. לא בוצע שינוי.");
    process.exit(1);
  }
  if (preview.length > 1) {
    console.error("[create-root] נמצאו מספר משתמשים תואמים — יש להשתמש ב---id. לא בוצע שינוי.");
    process.exit(1);
  }

  const u = preview[0] as Record<string, unknown>;
  console.log("\nמשתמש שנבחר לקידום למנהל־על ראשי מוגן (root):");
  console.log(`  id:                ${String(u._id)}`);
  console.log(`  שם משתמש:          ${u.username ?? ""}`);
  console.log(`  שם תצוגה:          ${u.displayName ?? "(ללא)"}`);
  console.log(`  תפקיד נוכחי:       ${u.role ?? "(ללא)"}`);
  console.log(`  root נוכחי:        ${u.isRootSuperAdmin === true ? "כן" : "לא"}`);
  console.log(`  סטטוס:             ${u.status ?? "(ללא)"}`);
  console.log(`  קורס:              ${u.courseType ?? "(ללא)"}`);
  console.log("\nלאחר האישור ייקבע:");
  console.log("  role=super_admin, isRootSuperAdmin=true, status=active, courseType=null, courseId=null");
  if (rootProfile) console.log(`  rootProfile=${rootProfile}`);
  if (visibility) console.log(`  directoryVisibility=${visibility}`);
  console.log("");

  if (!skipConfirm) {
    const rl = readline.createInterface({ input, output });
    const answer = (await rl.question('הקלד "PROMOTE" לאישור הקידום: ')).trim();
    rl.close();
    if (answer !== "PROMOTE") {
      console.log("[create-root] בוטל. לא בוצע שינוי.");
      await mongoose.disconnect();
      process.exit(0);
    }
  }

  const result = await promoteToRoot({ username, userId }, { visibility, rootProfile });
  if (!result.ok) {
    console.error(`[create-root] נכשל: ${result.reason}. לא בוצע שינוי.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(
    result.alreadyRoot
      ? "\n[create-root] המשתמש כבר היה root — הערכים אושרו מחדש (idempotent)."
      : "\n[create-root] ✓ הקידום למנהל־על ראשי מוגן בוצע בהצלחה.",
  );
  console.log(`  ${result.user.username} · role=${result.user.role} · root=${result.user.isRootSuperAdmin} · profile=${result.user.rootProfile ?? "—"} · visibility=${result.user.directoryVisibility}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("[create-root] שגיאה:", err);
  process.exit(1);
});
