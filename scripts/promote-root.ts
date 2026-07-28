/**
 * Reusable, side-effect-free promotion of an EXISTING user to a protected root
 * super-admin. Imported by both the interactive bootstrap CLI (create-root.ts) and
 * the development test-data seed. It is intentionally NOT in `src/` and is never
 * imported by any API route — root promotion has no website path.
 *
 * It never creates a user, never resets anything, never selects or prints a
 * password hash, and is idempotent (re-promoting a root is a no-op).
 */
import { isValidObjectId } from "mongoose";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import type { DirectoryVisibility, RootProfile } from "@/lib/domain/types";

export type RootSummary = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  isRootSuperAdmin: boolean;
  rootProfile: string | null;
  status: string;
  directoryVisibility: string;
};

export type PromoteResult =
  | { ok: true; alreadyRoot: boolean; user: RootSummary }
  | { ok: false; reason: "not_found" | "ambiguous" };

// Positive projection — passwordHash is never selected, so it can never be printed.
const SUMMARY_PROJECTION =
  "_id username displayName role isRootSuperAdmin rootProfile status directoryVisibility";

/**
 * Find a user by exact id or exact username and promote them to a protected root
 * super-admin: role=super_admin, isRootSuperAdmin=true, status=active. A root is
 * GLOBAL, so its course is cleared (courseType/courseId → null). Optionally sets the
 * rootProfile (platform_owner | school_commander) and directoryVisibility.
 */
export async function promoteToRoot(
  identifier: { username?: string; userId?: string },
  opts: { visibility?: DirectoryVisibility; rootProfile?: RootProfile } = {},
): Promise<PromoteResult> {
  await connectToDatabase();

  let query: Record<string, unknown> | null = null;
  if (identifier.userId && isValidObjectId(identifier.userId)) {
    query = { _id: identifier.userId };
  } else if (identifier.username) {
    query = { username: identifier.username };
  }
  if (!query) return { ok: false, reason: "not_found" };

  const existing = await User.find(query).select(SUMMARY_PROJECTION).lean();
  if (existing.length === 0) return { ok: false, reason: "not_found" };
  if (existing.length > 1) return { ok: false, reason: "ambiguous" };

  const before = existing[0] as unknown as RootSummary & { _id: unknown };
  const alreadyRoot = before.role === "super_admin" && before.isRootSuperAdmin === true;

  const set: Record<string, unknown> = {
    role: "super_admin",
    isRootSuperAdmin: true,
    status: "active",
    // A root is global — it never carries a course.
    courseType: null,
    courseId: null,
  };
  if (opts.visibility) set.directoryVisibility = opts.visibility;
  if (opts.rootProfile) set.rootProfile = opts.rootProfile;

  await User.updateOne({ _id: before._id }, { $set: set });

  const after = await User.findById(before._id).select(SUMMARY_PROJECTION).lean();
  const doc = after as unknown as (RootSummary & { _id: unknown }) | null;
  return {
    ok: true,
    alreadyRoot,
    user: {
      id: String(doc?._id ?? before._id),
      username: doc?.username ?? before.username ?? "",
      displayName: doc?.displayName ?? before.displayName ?? "",
      role: doc?.role ?? "super_admin",
      isRootSuperAdmin: doc?.isRootSuperAdmin ?? true,
      rootProfile: doc?.rootProfile ?? opts.rootProfile ?? null,
      status: doc?.status ?? "active",
      directoryVisibility: doc?.directoryVisibility ?? opts.visibility ?? "visible",
    },
  };
}
