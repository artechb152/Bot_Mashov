import bcrypt from "bcryptjs";

/**
 * Password hashing (bcryptjs — pure JS, no native build). Node runtime only;
 * never import this from `middleware.ts` (edge). Kept separate from session.ts.
 */

const SALT_ROUNDS = 10;

// A precomputed valid hash, compared against when a user does not exist so login
// timing does not reveal whether a username is registered.
const DUMMY_HASH = bcrypt.hashSync("timing-equalizer-not-a-real-password", SALT_ROUNDS);

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Constant-work verify: falls back to a dummy hash when `hash` is null. */
export function verifyPasswordOrDummy(plain: string, hash: string | null): Promise<boolean> {
  return bcrypt.compare(plain, hash ?? DUMMY_HASH);
}
