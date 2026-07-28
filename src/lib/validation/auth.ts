/**
 * Hand-rolled validators for the auth request bodies (same style as
 * `parseTraineeBody`). All error messages are Hebrew and user-facing.
 */
import { isAdminPosition, isCourseType, type AdminPosition, type CourseType } from "@/lib/domain/types";

export type SignupData = { username: string; password: string; courseType: CourseType };
export type LoginData = { username: string; password: string };
export type CourseChoiceData = { courseType: CourseType };

/** Staff self-signup — course + cohort + team are validated for existence server-side. */
export type StaffSignupData = {
  displayName: string;
  username: string;
  password: string;
  courseType: CourseType;
  cohortId: string;
  teamId: string;
};

/** Admin self-signup via a temporary invite code. */
export type AdminSignupData = {
  displayName: string;
  username: string;
  password: string;
  inviteCode: string;
  adminPosition: AdminPosition;
};

export type AuthParseResult<T> = { ok: true; data: T } | { ok: false; errors: string[] };

export const MIN_USERNAME_LENGTH = 2;
export const MAX_USERNAME_LENGTH = 21;
export const MIN_PASSWORD_LENGTH = 6;
export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 60;

// Hebrew letters + English letters + digits + spaces + simple symbols (. _ -).
const USERNAME_RE = /^[֐-׿a-zA-Z0-9 ._-]+$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Shared username rule. Returns an error string or null. */
export function validateUsername(username: string): string | null {
  if (username.length < MIN_USERNAME_LENGTH) {
    return `יש להזין שם משתמש (לפחות ${MIN_USERNAME_LENGTH} תווים).`;
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    return `שם המשתמש יכול להכיל עד ${MAX_USERNAME_LENGTH} תווים.`;
  }
  if (!USERNAME_RE.test(username)) {
    return "שם המשתמש יכול להכיל אותיות (עברית/אנגלית), ספרות, רווחים וסימנים פשוטים (. _ -).";
  }
  return null;
}

/** Shared password rule (with confirmation). Returns an error string or null. */
export function validatePassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`;
  }
  if (password !== confirm) {
    return "הסיסמאות אינן תואמות.";
  }
  return null;
}

/** Shared display-name rule. Returns an error string or null. */
export function validateDisplayName(displayName: string): string | null {
  if (displayName.length < MIN_DISPLAY_NAME_LENGTH) {
    return "יש להזין שם תצוגה.";
  }
  if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
    return `שם התצוגה יכול להכיל עד ${MAX_DISPLAY_NAME_LENGTH} תווים.`;
  }
  return null;
}

export function parseSignup(body: unknown): AuthParseResult<SignupData> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: ["גוף הבקשה אינו תקין."] };
  }
  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  const username = asString(b.username).trim();
  const password = asString(b.password);
  const confirmPassword = asString(b.confirmPassword);
  const courseType = b.courseType;

  if (username.length < MIN_USERNAME_LENGTH) {
    errors.push(`יש להזין שם משתמש (לפחות ${MIN_USERNAME_LENGTH} תווים).`);
  } else if (username.length > MAX_USERNAME_LENGTH) {
    errors.push(`שם המשתמש יכול להכיל עד ${MAX_USERNAME_LENGTH} תווים.`);
  } else if (!USERNAME_RE.test(username)) {
    errors.push(
      "שם המשתמש יכול להכיל אותיות (עברית/אנגלית), ספרות, רווחים וסימנים פשוטים (. _ -).",
    );
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    errors.push(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים.`);
  }
  if (password !== confirmPassword) {
    errors.push("הסיסמאות אינן תואמות.");
  }
  if (!isCourseType(courseType)) {
    errors.push("יש לבחור קורס.");
  }

  if (errors.length || !isCourseType(courseType)) {
    return { ok: false, errors: errors.length ? errors : ["יש לבחור קורס."] };
  }
  return { ok: true, data: { username, password, courseType } };
}

/** Validates the one-time course choice submitted to POST /api/auth/course. */
export function parseCourseChoice(body: unknown): AuthParseResult<CourseChoiceData> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: ["גוף הבקשה אינו תקין."] };
  }
  const courseType = (body as Record<string, unknown>).courseType;
  if (!isCourseType(courseType)) {
    return { ok: false, errors: ["יש לבחור קורס."] };
  }
  return { ok: true, data: { courseType } };
}

export function parseLogin(body: unknown): AuthParseResult<LoginData> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: ["גוף הבקשה אינו תקין."] };
  }
  const b = body as Record<string, unknown>;
  const username = asString(b.username).trim();
  const password = asString(b.password);
  if (!username || !password) {
    return { ok: false, errors: ["יש להזין שם משתמש וסיסמה."] };
  }
  return { ok: true, data: { username, password } };
}

/**
 * Staff self-signup. Validates format only; the route validates that the
 * cohort/team actually belong to the course and are selectable (server-side).
 * `role` is NEVER read from the body — it is assigned server-side.
 */
export function parseStaffSignup(body: unknown): AuthParseResult<StaffSignupData> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: ["גוף הבקשה אינו תקין."] };
  }
  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  const displayName = asString(b.displayName).trim();
  const username = asString(b.username).trim();
  const password = asString(b.password);
  const confirmPassword = asString(b.confirmPassword);
  const courseType = b.courseType;
  const cohortId = asString(b.cohortId).trim();
  const teamId = asString(b.teamId).trim();

  const dnErr = validateDisplayName(displayName);
  if (dnErr) errors.push(dnErr);
  const unErr = validateUsername(username);
  if (unErr) errors.push(unErr);
  const pwErr = validatePassword(password, confirmPassword);
  if (pwErr) errors.push(pwErr);
  if (!isCourseType(courseType)) errors.push("יש לבחור קורס.");
  if (!cohortId) errors.push("יש לבחור מחזור.");
  if (!teamId) errors.push("יש לבחור צוות.");

  if (errors.length || !isCourseType(courseType)) {
    return { ok: false, errors: errors.length ? errors : ["יש לבחור קורס."] };
  }
  return { ok: true, data: { displayName, username, password, courseType, cohortId, teamId } };
}

/**
 * Admin self-signup via a temporary invite code. Validates format only; the route
 * validates + atomically consumes the invite and confirms the chosen position is
 * allowed by it. `role`/`courseId` are NEVER taken from the body.
 */
export function parseAdminSignup(body: unknown): AuthParseResult<AdminSignupData> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, errors: ["גוף הבקשה אינו תקין."] };
  }
  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  const displayName = asString(b.displayName).trim();
  const username = asString(b.username).trim();
  const password = asString(b.password);
  const confirmPassword = asString(b.confirmPassword);
  const inviteCode = asString(b.inviteCode).trim();
  const adminPosition = b.adminPosition;

  const dnErr = validateDisplayName(displayName);
  if (dnErr) errors.push(dnErr);
  const unErr = validateUsername(username);
  if (unErr) errors.push(unErr);
  const pwErr = validatePassword(password, confirmPassword);
  if (pwErr) errors.push(pwErr);
  if (!inviteCode) errors.push("יש להזין קוד הרשאה.");
  if (!isAdminPosition(adminPosition)) errors.push("יש לבחור תפקיד ניהולי (מק״ס או סמק״ס).");

  if (errors.length || !isAdminPosition(adminPosition)) {
    return { ok: false, errors: errors.length ? errors : ["יש לבחור תפקיד ניהולי."] };
  }
  return { ok: true, data: { displayName, username, password, inviteCode, adminPosition } };
}
