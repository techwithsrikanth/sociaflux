import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MIN_PASSWORD_LENGTH, hashPassword, needsRehash, passwordProblem, verifyPassword } from "../src/lib/auth/passwords";
import { createSessionToken, readSessionToken } from "../src/lib/auth/session";
import { emailProblem, normaliseEmail } from "../src/lib/auth/users";

describe("passwordProblem", () => {
  it("rejects passwords that are too short", () => {
    assert.ok(passwordProblem("short"));
    assert.ok(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH - 1)));
    assert.equal(passwordProblem("a".repeat(MIN_PASSWORD_LENGTH)), null);
  });

  it("rejects absurdly long passwords", () => {
    // A deliberately slow hash turns an unbounded input into a cheap DoS.
    assert.ok(passwordProblem("a".repeat(201)));
    assert.equal(passwordProblem("a".repeat(200)), null);
  });
});

describe("hashPassword / verifyPassword", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("correct horse battery");
    assert.equal(await verifyPassword("correct horse battery", hash), true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    assert.equal(await verifyPassword("Correct horse battery", hash), false);
    assert.equal(await verifyPassword("", hash), false);
  });

  it("never stores the password itself", async () => {
    const hash = await hashPassword("hunter2hunter2");
    assert.ok(!hash.includes("hunter2hunter2"));
    assert.match(hash, /^scrypt\$\d+\$\d+\$\d+\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  });

  it("salts, so equal passwords do not collide", async () => {
    const [a, b] = await Promise.all([hashPassword("same password"), hashPassword("same password")]);
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("same password", a), true);
    assert.equal(await verifyPassword("same password", b), true);
  });

  it("treats a corrupt stored hash as a failed login rather than throwing", async () => {
    for (const bad of ["", "not-a-hash", "scrypt$1$2$3", "bcrypt$1$2$3$aaaa$bbbb", "scrypt$x$y$z$!!!$!!!"]) {
      assert.equal(await verifyPassword("anything", bad), false);
    }
  });
});

describe("needsRehash", () => {
  it("is false for a hash at current cost", async () => {
    assert.equal(needsRehash(await hashPassword("a password")), false);
  });

  it("is true for weaker parameters or an unknown scheme", () => {
    assert.equal(needsRehash("scrypt$1024$8$1$c2FsdA==$aGFzaA=="), true);
    assert.equal(needsRehash("bcrypt$12$x$y$z$w"), true);
    assert.equal(needsRehash(""), true);
  });
});

describe("session tokens", () => {
  const session = { userId: "user-1", role: "creator" as const, email: "a@b.com", handle: "@maya" };

  it("round-trips a session", async () => {
    const decoded = await readSessionToken(await createSessionToken(session));
    // `name` is optional and absent here, so it comes back undefined.
    assert.deepEqual(decoded, { ...session, name: undefined });
  });

  it("rejects a tampered payload", async () => {
    const token = await createSessionToken(session);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ ...session, role: "brand", exp: 9999999999 })).toString("base64url");
    assert.equal(await readSessionToken(`${forged}.${signature}`), null);
    assert.equal(await readSessionToken(`${payload}.${"a".repeat(signature.length)}`), null);
  });

  it("rejects an expired session", async () => {
    assert.equal(await readSessionToken(await createSessionToken(session, -1)), null);
  });

  it("rejects malformed input", async () => {
    for (const bad of ["", "nodot", ".", "a.", ".b"]) {
      assert.equal(await readSessionToken(bad), null);
    }
    assert.equal(await readSessionToken(undefined), null);
  });

  it("carries no secret in the token body", async () => {
    const token = await createSessionToken(session);
    const payload = Buffer.from(token.split(".")[0], "base64url").toString();
    assert.ok(!/password|hash|secret/i.test(payload));
  });

  it("round-trips the display name, so the workspace knows the brand/creator name on reload", async () => {
    const named = { ...session, role: "brand" as const, name: "Vivo India", handle: undefined };
    const decoded = await readSessionToken(await createSessionToken(named));
    assert.equal(decoded?.name, "Vivo India");
  });
});

describe("emails", () => {
  it("normalises case and whitespace", () => {
    assert.equal(normaliseEmail("  Maya@Example.COM "), "maya@example.com");
  });

  it("accepts ordinary addresses and rejects obvious nonsense", () => {
    assert.equal(emailProblem("maya@example.com"), null);
    assert.equal(emailProblem("maya+tag@sub.example.co.in"), null);
    assert.ok(emailProblem(""));
    assert.ok(emailProblem("maya"));
    assert.ok(emailProblem("maya@example"));
    assert.ok(emailProblem("maya @example.com"));
  });
});
