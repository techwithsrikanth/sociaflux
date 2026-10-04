/**
 * Applies src/lib/db/schema.sql to the configured database.
 *
 * The schema is written with IF NOT EXISTS throughout, so running this repeatedly
 * is safe and is how schema changes get applied.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { databaseUrl, getDb, isRemoteDatabase } from "../src/lib/db/client";

async function main() {
  const sql = readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");

  // libSQL executes one statement per call, so split on the statement terminator
  // and drop comment-only fragments.
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement && !statement.split("\n").every((line) => line.trim().startsWith("--")));

  const db = getDb();
  for (const statement of statements) {
    await db.execute(statement);
  }

  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
  console.log(`Applied ${statements.length} statements to ${isRemoteDatabase() ? "Turso" : databaseUrl()}`);
  console.log("Tables:", tables.rows.map((row) => row.name).join(", "));
}

main().catch((error) => {
  console.error("Migration failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
