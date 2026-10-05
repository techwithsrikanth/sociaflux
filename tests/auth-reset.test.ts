import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { closeDb, getDb } from "../src/lib/db/client";
import { createResetToken, consumeResetToken } from "../src/lib/auth/reset";
import { createUser } from "../src/lib/auth/users";

// Throwaway file database, like db-repositories.test.ts. The client reads the
// environment on first getDb(), so setting it after the imports is fine.
const workdir = mkdtempSync(join(tmpdir(), "sociaflux-reset-"));
process.env.SOCIAFLUX_TURSO_DATABASE_URL = `file:${join(workdir, "test.db").replace(/\\/g, "/")}`;
delete process.env.SOCIAFLUX_TURSO_AUTH_TOKEN;

let userId = "";

before(async () => {
  const sql = readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement && !statement.split("\n").every((line) => line.trim().startsWith("--")));
  for (const statement of statements) await getDb().execute(statement);

  const user = await createUser({ email: "reset@example.com", passwordHash: "scrypt$1$1$1$a$b", role: "brand", displayName: "Reset Co" });
  userId = user.id;
});

after(() => {
  closeDb();
  try {
    rmSync(workdir, { recursive: true, force: true });
  } catch {
    /* temp dir is disposable */
  }
});

describe("password reset tokens", () => {
  it("issues a token that resolves to its user, exactly once", async () => {
    const token = await createResetToken(userId);
    assert.equal(await consumeResetToken(token), userId);
    // Second use must fail: single-use is the whole point.
    assert.equal(await consumeResetToken(token), null);
  });

  it("never stores the raw token, only a hash of it", async () => {
    const token = await createResetToken(userId);
    const rows = await getDb().execute("SELECT token_hash FROM password_resets");
    for (const row of rows.rows) {
      assert.notEqual(row.token_hash, token);
      assert.match(String(row.token_hash), /^[0-9a-f]{64}$/);
    }
  });

  it("rejects an unknown token", async () => {
    assert.equal(await consumeResetToken("never-issued"), null);
    assert.equal(await consumeResetToken(""), null);
  });

  it("retires earlier unused tokens when a new one is issued", async () => {
    const first = await createResetToken(userId);
    const second = await createResetToken(userId);
    // Requesting a fresh link must invalidate the previous one, so an old
    // email cannot be used after the user asked again.
    assert.equal(await consumeResetToken(first), null);
    assert.equal(await consumeResetToken(second), userId);
  });

  it("does not let two requests consume the same token", async () => {
    const token = await createResetToken(userId);
    const [a, b] = await Promise.all([consumeResetToken(token), consumeResetToken(token)]);
    const successes = [a, b].filter((result) => result === userId);
    assert.equal(successes.length, 1, "exactly one concurrent consume should win");
  });
});
