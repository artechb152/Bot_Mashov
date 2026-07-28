import { SignJWT, jwtVerify } from "jose";
import { isCourseType, type CourseType } from "@/lib/domain/types";

/**
 * Stateless auth session: a short user identity signed into a JWT (HS256) and
 * stored in an httpOnly cookie. This module is EDGE-SAFE — it imports only
 * `jose` and reads `process.env.SESSION_SECRET`, so `middleware.ts` can verify
 * sessions without pulling in Node-only code (bcrypt, mongoose, next/headers).
 */

export const SESSION_COOKIE_NAME = "matzpen_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

/**
 * `courseType` is nullable on purpose: a session minted before courses existed —
 * or one belonging to a legacy user who never chose — simply carries none. Those
 * users are routed once through /select-course, which re-signs the cookie. Every
 * course-scoped query therefore requires a NON-null course, so a course-less
 * session can never read course-scoped data.
 */
export type SessionUser = {
  id: string;
  username: string;
  courseType: CourseType | null;
};

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET אינו מוגדר. יש להוסיפו ל-.env.local.");
  }
  return new TextEncoder().encode(secret);
}

/** Sign a session token for the given user. */
export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ username: user.username, courseType: user.courseType ?? null })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

/** Verify a session token → the identity, or null if invalid/expired. */
export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { algorithms: ["HS256"] });
    const id = typeof payload.sub === "string" ? payload.sub : "";
    const username = typeof payload.username === "string" ? payload.username : "";
    if (!id || !username) return null;
    // Tokens minted before courses existed have no `courseType` claim, and a
    // claim that is not a known course is treated as absent rather than trusted.
    const courseType = isCourseType(payload.courseType) ? payload.courseType : null;
    return { id, username, courseType };
  } catch {
    return null;
  }
}

/** Cookie attributes for the session cookie (set on create, cleared with maxAge 0). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}
