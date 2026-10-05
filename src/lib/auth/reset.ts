/**
 * Password reset tokens.
 *
 * The raw token is random and goes only into the link that is sent. What the
 * database holds is its SHA-256, so a leaked `password_resets` table cannot be
 * turned into a reset for anybody: an attacker would still need the raw token,
 * which was never stored.
 *
 * Tokens are single-use (`used_at`) and short-lived, and issuing a new one for
 * an account retires that account's older unused tokens, so a reset link stops
 * working the moment a newer one is requested.
 */

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { getDb } from "../db/client";

const TOKEN_BYTES = 32;
export const RESET_TOKEN_TTL_MINUTES = 60;

function hashToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Returns the raw token to put in the link; only its hash is persisted. */
export async function createResetToken(userId: string): Promise<string> {
  const rawToken = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();

  const db = getDb();
  // Retire this account's earlier unused tokens, so only the newest link works.
  await db.execute({
    sql: "UPDATE password_resets SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL",
    args: [userId]
  });
  await db.execute({
    sql: "INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    args: [randomUUID(), userId, hashToken(rawToken), expiresAt]
  });

  return rawToken;
}

/**
 * Returns the user id a valid, unused, unexpired token belongs to, and marks
 * it used in the same step so it cannot be replayed. Returns null for anything
 * wrong, without saying which, so a bad token and an expired one look alike.
 */
export async function consumeResetToken(rawToken: string): Promise<string | null> {
  if (!rawToken || typeof rawToken !== "string") return null;

  const db = getDb();
  const result = await db.execute({
    sql: "SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?",
    args: [hashToken(rawToken)]
  });
  const row = result.rows[0];
  if (!row || row.used_at) return null;
  if (new Date(String(row.expires_at)).getTime() < Date.now()) return null;

  // Mark used only if still unused, so two requests cannot both succeed.
  const claimed = await db.execute({
    sql: "UPDATE password_resets SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL",
    args: [row.id]
  });
  if (claimed.rowsAffected !== 1) return null;

  return String(row.user_id);
}
