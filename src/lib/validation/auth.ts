/**
 * Hand-rolled validators for the auth request bodies (same style as
 * `parseTraineeBody`). All error messages are Hebrew and user-facing.
 */

export type SignupData = { username: string; password: string };
export type LoginData = { username: string; password: string };

export type AuthParseResult<T> = { ok: true; data: T } | { ok: false; errors: string[] };

export const MIN_USERNAME_LENGTH = 2;
export const MAX_USERNAME_LENGTH = 21;
export const MIN_PASSWORD_LENGTH = 6;

// Hebrew letters + English letters + digits + spaces + simple symbols (. _ -).
const USERNAME_RE = /^[֐-׿a-zA-Z0-9 ._-]+$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
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

  if (errors.length) return { ok: false, errors };
  return { ok: true, data: { username, password } };
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
