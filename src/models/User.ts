import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import {
  ADMIN_POSITIONS,
  COURSE_TYPES,
  DIRECTORY_VISIBILITIES,
  ONBOARDING_STATUSES,
  ROOT_PROFILES,
  USER_ROLES,
  USER_STATUSES,
} from "@/lib/domain/types";

/**
 * A staff / admin / super-admin account. Every field added for the RBAC + org
 * redesign is optional or defaulted, so records that predate it still validate.
 * Relationships use immutable ObjectIds — never the (mutable) username.
 */
const userSchema = new Schema(
  {
    // Identity ---------------------------------------------------------------
    fullName: { type: String, required: true, trim: true },
    // Human display name (falls back to fullName/username in the UI when absent).
    displayName: { type: String, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    // Case/space-normalized username for uniqueness checks (Hebrew supported).
    // Sparse: legacy rows without it don't collide on `null`.
    normalizedUsername: { type: String, trim: true },
    passwordHash: { type: String, required: true },

    // Privilege --------------------------------------------------------------
    role: { type: String, enum: [...USER_ROLES], required: true, default: "staff" },
    // Protected ROOT tier — orthogonal to role, set ONLY by the bootstrap script.
    isRootSuperAdmin: { type: Boolean, required: true, default: false },
    // Protected-root PROFILE (platform_owner | school_commander) — set ONLY by the
    // bootstrap script, never via any website route. null for everyone else.
    rootProfile: { type: String, enum: [...ROOT_PROFILES] },
    status: { type: String, enum: [...USER_STATUSES], required: true, default: "active" },
    // Display/filter metadata for admins (מק״ס / סמק״ס) — not an authz level.
    adminPosition: { type: String, enum: [...ADMIN_POSITIONS] },
    directoryVisibility: {
      type: String,
      enum: [...DIRECTORY_VISIBILITIES],
      required: true,
      default: "visible",
    },
    onboardingStatus: {
      type: String,
      enum: [...ONBOARDING_STATUSES],
      required: true,
      default: "complete",
    },

    // Course placement -------------------------------------------------------
    // Legacy/authoritative scope key (kapeh|maksim). Kept as the source of truth
    // during the courseType→courseId transition.
    courseType: { type: String, enum: [...COURSE_TYPES] },
    // Additive denormalized ref, carried but not yet filtered on for authz.
    courseId: { type: Schema.Types.ObjectId, ref: "Course" },
    // Personal preference: the cohort the work area opens on. NOT an authz field —
    // access is still course+owner+grants. Set by the user (selecting a cohort) and
    // stamped for the creator when they create a cohort. Falls back at resolve time
    // when absent/invalid (current assignment → most recent accessible cohort).
    defaultCohortId: { type: Schema.Types.ObjectId, ref: "Cohort" },

    // Activity ---------------------------------------------------------------
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

// Case-insensitive uniqueness (sparse so legacy rows without it don't collide).
userSchema.index({ normalizedUsername: 1 }, { unique: true, sparse: true });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ courseId: 1 });
userSchema.index({ directoryVisibility: 1 });
userSchema.index({ createdAt: -1 });

export type UserDoc = InferSchemaType<typeof userSchema>;

// Guard against model re-compilation during Next.js dev hot-reload.
export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);
