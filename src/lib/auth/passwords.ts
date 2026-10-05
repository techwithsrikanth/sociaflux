/**
 * Password hashing with scrypt from node:crypto.
 *
 * scrypt is memory-hard, which is what makes a stolen `users` table expensive
 * to crack rather than merely slow. It ships with Node, so this costs no
 * dependency and nothing to keep patched.
 *
 * The cost parameters are stored inside each hash. Raising them later only
 * affects new passwords; old ones keep verifying against the parameters they
 * were created with, and `needsRehash` says which those are.
 */

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number, options: { N: number; r: number; p: number; maxmem: number }) => Promise<Buffer>;

/** ~64 MB of memory per hash at N=16384, r=8. */
const COST = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

/** Node's default maxmem (32 MB) is below what N=16384, r=8 needs. */
const MAX_MEM = 128 * 1024 * 1024;

export const MIN_PASSWORD_LENGTH = 8;

export function passwordProblem(password: string): string | null {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  // Long inputs are a cheap denial of service against a deliberately slow
  // hash, so cap them well above anything a person would type.
  if (password.length > 200) return "Password must be 200 characters or fewer.";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH, { ...COST, maxmem: MAX_MEM });
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64"), derived.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const [, n, r, p, saltB64, hashB64] = parts;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  if (!salt.length || !expected.length) return false;

  let derived: Buffer;
  try {
    derived = await scrypt(password, salt, expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEM });
  } catch {
    // Unparseable or absurd cost parameters: treat as a failed login rather
    // than a crash, so a corrupt row cannot take the login route down.
    return false;
  }

  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

/** True when a stored hash predates the current cost parameters. */
export function needsRehash(stored: string): boolean {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return true;
  return Number(parts[1]) < COST.N || Number(parts[2]) < COST.r || Number(parts[3]) < COST.p;
}
