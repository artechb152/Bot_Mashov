import { createHash, randomInt } from "node:crypto";

/**
 * High-entropy admin invite codes. Format: ADM-XXXX-XXXX-XXXX over an unambiguous
 * 32-char alphabet (no 0/O/1/I) → 12 chars ≈ 60 bits of entropy. Only the SHA-256
 * hash of the NORMALIZED code is ever stored; the plaintext is shown once and
 * never persisted or logged.
 *
 * Node's built-in crypto only — no external dependency, no AI. Server-only.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Canonical form for hashing/compare: uppercase, alphanumerics only (dashes/spaces ignored). */
export function normalizeInviteCode(raw: string): string {
  return (raw ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashInviteCode(raw: string): string {
  return createHash("sha256").update(normalizeInviteCode(raw)).digest("hex");
}

export function generateInviteCode(): { plaintext: string; codeHash: string } {
  const group = () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const plaintext = `ADM-${group()}-${group()}-${group()}`;
  return { plaintext, codeHash: hashInviteCode(plaintext) };
}
