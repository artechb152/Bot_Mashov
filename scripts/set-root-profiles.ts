/**
 * One-time bootstrap: stamp `rootProfile` on the two protected ROOT accounts, so the
 * reset script (and the app) can identify them by profile as designed. Idempotent and
 * PREVIEW BY DEFAULT — writes only with `--confirm`. It touches ONLY rootProfile on the
 * two accounts; it never changes role, isRootSuperAdmin, passwords, or anyone else.
 *
 * Identity is verified from the DB, not assumed: the two target usernames (overridable
 * via --owner / --commander) must each resolve to exactly one account, both must be
 * isRootSuperAdmin=true super_admins, and together they must equal the FULL set of
 * isRootSuperAdmin=true accounts (no extra root left unmapped). Otherwise it ABORTS.
 *
 * Preview:  npx tsx scripts/set-root-profiles.ts
 * Write:    npx tsx scripts/set-root-profiles.ts --confirm
 */
import { loadEnvConfig } from "@next/env";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";

loadEnvConfig(process.cwd());

const arg = (name: string, fallback: string): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split("=").slice(1).join("=") : fallback;
};
const OWNER_USERNAME = arg("owner", "owner.root.test");
const COMMANDER_USERNAME = arg("commander", "commander.root.test");
const WRITE = process.argv.includes("--confirm");

type LeanUser = {
  _id: unknown;
  username?: string;
  displayName?: string;
  role?: string;
  isRootSuperAdmin?: boolean;
  rootProfile?: string | null;
  status?: string;
};

class Abort extends Error {}

async function main(): Promise<void> {
  await connectToDatabase();
  console.log(`\nDB="${mongoose.connection.name}"  mode=${WRITE ? "WRITE (--confirm)" : "preview"}`);

  const rootFlagged = await User.find({ isRootSuperAdmin: true }).lean<LeanUser[]>();
  if (rootFlagged.length !== 2) {
    throw new Abort(`Expected exactly 2 isRootSuperAdmin=true accounts, found ${rootFlagged.length}. Aborting.`);
  }

  const find = (username: string): LeanUser => {
    const hits = rootFlagged.filter((u) => u.username === username);
    if (hits.length === 0) throw new Abort(`No isRootSuperAdmin account with username "${username}". Aborting.`);
    if (hits.length > 1) throw new Abort(`Ambiguous: ${hits.length} accounts with username "${username}". Aborting.`);
    return hits[0];
  };

  const owner = find(OWNER_USERNAME);
  const commander = find(COMMANDER_USERNAME);
  if (String(owner._id) === String(commander._id)) throw new Abort("Owner and commander resolved to the same account. Aborting.");

  // The two mapped accounts must BE the full isRootSuperAdmin set (nothing unmapped).
  const mapped = new Set([String(owner._id), String(commander._id)]);
  const unmapped = rootFlagged.filter((u) => !mapped.has(String(u._id)));
  if (unmapped.length > 0) throw new Abort(`isRootSuperAdmin account(s) not covered by the mapping: ${unmapped.map((u) => u.username).join(", ")}. Aborting.`);

  for (const [label, u] of [["owner/platform_owner", owner], ["commander/school_commander", commander]] as const) {
    if (u.role !== "super_admin") throw new Abort(`${label} (${u.username}) role="${u.role}" (expected super_admin). Aborting.`);
    if (u.status !== "active") throw new Abort(`${label} (${u.username}) status="${u.status}" (expected active). Aborting.`);
  }

  const plan = [
    { u: owner, target: "platform_owner" as const },
    { u: commander, target: "school_commander" as const },
  ];

  console.log("\nplanned rootProfile stamping:");
  for (const { u, target } of plan) {
    console.log(`  • ${u.username} ("${u.displayName ?? ""}")  ${u.rootProfile ?? "null"} → ${target}`);
  }

  if (!WRITE) {
    console.log("\n(preview only — no write). Re-run with --confirm to apply.");
    return;
  }

  for (const { u, target } of plan) {
    if (u.rootProfile === target) {
      console.log(`  = ${u.username} already ${target} (skipped)`);
      continue;
    }
    await User.updateOne({ _id: u._id, isRootSuperAdmin: true }, { $set: { rootProfile: target } });
    console.log(`  ✓ ${u.username} → ${target}`);
  }
  console.log("\n✓ rootProfile stamping complete.");
}

main()
  .catch((e) => {
    if (e instanceof Abort) {
      console.error(`\n✗ ABORTED (no write): ${e.message}`);
      process.exit(2);
    }
    console.error("\n✗ failed:", e);
    process.exit(1);
  })
  .finally(() => void mongoose.connection.close());
