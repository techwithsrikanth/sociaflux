import { createClient as createRemoteClient } from "@libsql/client/web";
import type { Client } from "@libsql/client";

/**
 * Single libSQL client for the process.
 *
 * Points at Turso when SOCIAFLUX_TURSO_DATABASE_URL is set, and falls back to a local
 * SQLite file otherwise, so the app still runs without credentials.
 */

let client: Client | null = null;

export function databaseUrl() {
  return process.env.SOCIAFLUX_TURSO_DATABASE_URL?.trim() || "file:./.data/sociaflux.db";
}

/** True only for a networked libSQL endpoint, not a local file: URL. */
export function isRemoteDatabase() {
  return /^(libsql|wss?|https?):\/\//i.test(databaseUrl());
}

export function getDb(): Client {
  if (client) return client;
  const url = databaseUrl();

  if (isRemoteDatabase()) {
    // The web build is pure JavaScript, so serverless deploys (Vercel) do not
    // have to bundle or load the native `libsql` binding.
    client = createRemoteClient({ url, authToken: process.env.SOCIAFLUX_TURSO_AUTH_TOKEN?.trim() });
    return client;
  }

  // A local file needs the native client. Only reached in development and tests,
  // and required lazily so it never ends up in a serverless bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
  client = createClient({ url });
  return client;
}

/** Releases the connection. Used by tests; the app keeps the singleton open. */
export function closeDb() {
  client?.close();
  client = null;
}

/** Reads a JSON column, tolerating nulls and anything that is not valid JSON. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || !value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toBool(value: unknown) {
  return value === 1 || value === true || value === "1";
}

export function toInt(value: unknown, fallback = 0) {
  const parsed = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function toText(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function nullableText(value: unknown) {
  return typeof value === "string" && value ? value : null;
}
