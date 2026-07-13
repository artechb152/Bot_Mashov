import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";
import { COURSE_TYPES, USER_ROLES } from "@/lib/domain/types";

const userSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, required: true },
    // Legacy/optional: course is no longer collected or shown. Kept (optional) for
    // existing records; new users omit it.
    courseType: { type: String, enum: [...COURSE_TYPES] },
    role: { type: String, enum: [...USER_ROLES], required: true, default: "commander" },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

// Guard against model re-compilation during Next.js dev hot-reload.
export const User: Model<UserDoc> =
  (models.User as Model<UserDoc>) ?? model<UserDoc>("User", userSchema);
