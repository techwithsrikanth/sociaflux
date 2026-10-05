/**
 * Account records.
 *
 * Kept apart from src/lib/db/repositories.ts on purpose: everything there
 * returns domain objects the UI serialises, and a password hash must never
 * end up in one by accident. Nothing in this module returns a hash except
 * `findByEmailWithSecret`, whose name is the warning.
 */

import { randomUUID } from "node:crypto";
import { getDb, nullableText, toText } from "../db/client";
import { normaliseHandle } from "../marketplace";
import type { SessionRole } from "./session";
import type { Row } from "@libsql/client";

export type User = {
  id: string;
  email: string;
  role: SessionRole;
  displayName: string;
  handle?: string;
  brandId?: string;
  createdAt: string;
  lastLoginAt?: string;
};

function rowToUser(row: Row): User {
  return {
    id: toText(row.id),
    email: toText(row.email),
    role: toText(row.role) === "brand" ? "brand" : "creator",
    displayName: toText(row.display_name, ""),
    handle: nullableText(row.handle) || undefined,
    brandId: nullableText(row.brand_id) || undefined,
    createdAt: toText(row.created_at, ""),
    lastLoginAt: nullableText(row.last_login_at) || undefined
  };
}

/** Emails are matched case-insensitively, so they are stored lowercased. */
export function normaliseEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function emailProblem(email: string): string | null {
  const value = normaliseEmail(email);
  if (!value) return "Enter your email address.";
  // Deliberately permissive: the only authority on whether an address works is
  // whether mail reaches it, and over-strict patterns reject valid addresses.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "That does not look like an email address.";
  if (value.length > 254) return "That email address is too long.";
  return null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await getDb().execute({ sql: "SELECT * FROM users WHERE email = ?", args: [normaliseEmail(email)] });
  return result.rows.length ? rowToUser(result.rows[0]) : null;
}

/** The only path that exposes the hash. Used by the login route and nothing else. */
export async function findUserByEmailWithSecret(email: string): Promise<(User & { passwordHash: string }) | null> {
  const result = await getDb().execute({ sql: "SELECT * FROM users WHERE email = ?", args: [normaliseEmail(email)] });
  if (!result.rows.length) return null;
  return { ...rowToUser(result.rows[0]), passwordHash: toText(result.rows[0].password_hash) };
}

export async function findUserByHandle(handle: string): Promise<User | null> {
  const result = await getDb().execute({ sql: "SELECT * FROM users WHERE handle = ?", args: [normaliseHandle(handle)] });
  return result.rows.length ? rowToUser(result.rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const result = await getDb().execute({ sql: "SELECT * FROM users WHERE id = ?", args: [id] });
  return result.rows.length ? rowToUser(result.rows[0]) : null;
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: SessionRole;
  displayName: string;
  handle?: string;
  brandId?: string;
}): Promise<User> {
  const id = randomUUID();
  const handle = input.handle ? normaliseHandle(input.handle) : null;

  await getDb().execute({
    sql: `INSERT INTO users (id, email, password_hash, role, display_name, handle, brand_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, normaliseEmail(input.email), input.passwordHash, input.role, input.displayName || "", handle, input.brandId || null]
  });

  const created = await findUserById(id);
  if (!created) throw new Error("Account was created but could not be read back.");
  return created;
}

export async function recordLogin(id: string) {
  await getDb().execute({ sql: "UPDATE users SET last_login_at = datetime('now') WHERE id = ?", args: [id] });
}

export async function updatePasswordHash(id: string, passwordHash: string) {
  await getDb().execute({ sql: "UPDATE users SET password_hash = ? WHERE id = ?", args: [passwordHash, id] });
}

/**
 * A creator profile may already exist from before accounts were introduced, or
 * from an Instagram connection. Signing up with that handle claims it, but
 * only if no other account has.
 */
export async function handleIsClaimed(handle: string): Promise<boolean> {
  const existing = await findUserByHandle(handle);
  return existing !== null;
}
