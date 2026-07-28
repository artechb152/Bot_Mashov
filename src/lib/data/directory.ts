import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/models";
import type { Account } from "@/lib/auth/account";
import { messageableIds } from "@/lib/data/recipients";
import {
  COURSE_LABELS,
  COURSE_TYPES,
  isAdminPosition,
  isUserRole,
  type AdminPosition,
  type CourseType,
  type UserRole,
} from "@/lib/domain/types";

/**
 * The user directory — a role-appropriate, hierarchical view. Hidden accounts
 * (the project-owner ghost) are NEVER included here — the directory is the
 * "normal" listing; hidden accounts are reachable only through root maintenance +
 * audit, not this view. Visibility filtering happens here; it never affects authz.
 *
 * Who a viewer sees:
 *   - staff       → visible staff + admins in their OWN course, plus visible
 *                   super-admins (and visible roots).
 *   - admin       → all visible users across the hierarchy.
 *   - super_admin → all visible users.
 *
 * Server-only.
 */

export type DirectoryCard = {
  id: string;
  displayName: string;
  username: string;
  role: UserRole;
  adminPosition: AdminPosition | null;
  isRootSuperAdmin: boolean;
  courseType: CourseType | null;
  /** Whether the CURRENT viewer may directly message this user (server-computed). */
  canMessage: boolean;
};

export type DirectoryCourse = {
  code: CourseType;
  name: string;
  admins: DirectoryCard[];
  staff: DirectoryCard[];
};

export type Directory = {
  roots: DirectoryCard[];
  superAdmins: DirectoryCard[];
  courses: DirectoryCourse[];
};

type LeanDir = {
  _id: unknown;
  displayName?: string;
  fullName?: string;
  username?: string;
  role?: string | null;
  adminPosition?: string | null;
  isRootSuperAdmin?: boolean | null;
  courseType?: string | null;
  directoryVisibility?: string | null;
  status?: string | null;
};

function card(u: LeanDir): DirectoryCard {
  return {
    id: String(u._id),
    displayName: u.displayName || u.fullName || u.username || "",
    username: u.username || "",
    role: isUserRole(u.role) ? u.role : "staff",
    adminPosition: isAdminPosition(u.adminPosition) ? u.adminPosition : null,
    isRootSuperAdmin: u.isRootSuperAdmin === true,
    courseType: COURSE_TYPES.includes(u.courseType as CourseType) ? (u.courseType as CourseType) : null,
    canMessage: false, // set below for admin/super viewers
  };
}

export async function listDirectory(account: Account): Promise<Directory> {
  await connectToDatabase();
  // Never include hidden accounts; never include disabled ones in the directory.
  const users = await User.find({
    directoryVisibility: { $ne: "hidden" },
    status: { $ne: "disabled" },
  })
    .select("_id displayName fullName username role adminPosition isRootSuperAdmin courseType status")
    .sort({ displayName: 1, username: 1 })
    .lean<LeanDir[]>();

  const canSee = (u: LeanDir): boolean => {
    if (account.role !== "staff") return true; // admin/super see all visible
    const c = card(u);
    if (c.role === "super_admin") return true; // visible supers/roots
    return c.courseType === account.courseType; // same-course staff + admins
  };

  const visible = users.filter(canSee).map(card);

  // "Send message" is offered only to managers (admin/super) and only for targets the
  // viewer is actually permitted to message — computed server-side with the SAME
  // filter as compose. Staff never get the direct action.
  if (account.role === "admin" || account.role === "super_admin") {
    const msgIds = await messageableIds(account, visible.map((v) => v.id));
    for (const v of visible) v.canMessage = msgIds.has(v.id);
  }

  const roots = visible.filter((u) => u.role === "super_admin" && u.isRootSuperAdmin);
  const superAdmins = visible.filter((u) => u.role === "super_admin" && !u.isRootSuperAdmin);

  const courses: DirectoryCourse[] = COURSE_TYPES.map((code) => ({
    code,
    name: COURSE_LABELS[code],
    admins: visible.filter((u) => u.role === "admin" && u.courseType === code),
    staff: visible.filter((u) => u.role === "staff" && u.courseType === code),
  })).filter((c) => c.admins.length > 0 || c.staff.length > 0);

  return { roots, superAdmins, courses };
}
