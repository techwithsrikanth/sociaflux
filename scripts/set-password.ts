/**
 * Sets an account's password.
 *
 *   npm run auth:password                         # list accounts
 *   npm run auth:password someone@example.com     # prompt for the new password
 *
 * There is no password reset flow in the app yet, and hashes cannot be read
 * back, so this is how a locked-out account gets rescued.
 *
 * The password is prompted for rather than taken as an argument, because a
 * command-line argument lands in shell history and in the process list where
 * other users on the machine can read it.
 */

import { createInterface } from "node:readline";
import { hashPassword, passwordProblem } from "../src/lib/auth/passwords";
import { findUserByEmail, normaliseEmail, updatePasswordHash } from "../src/lib/auth/users";
import { getDb } from "../src/lib/db/client";

/** Reads a line without echoing it, so the password does not stay on screen. */
function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const input = process.stdin;
    const rl = createInterface({ input, output: process.stdout, terminal: true });

    // readline echoes by default; muting the output stream hides the typing.
    const muted = rl as unknown as { output: NodeJS.WriteStream; _writeToOutput: (text: string) => void };
    let muting = false;
    muted._writeToOutput = function write(text: string) {
      if (!muting) muted.output.write(text);
    };

    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
    muting = true;
  });
}

async function listAccounts() {
  const result = await getDb().execute("SELECT email, role, display_name, handle FROM users ORDER BY created_at");
  if (!result.rows.length) {
    console.log("No accounts yet.");
    return;
  }
  console.log(`Accounts (${result.rows.length}):\n`);
  for (const row of result.rows) {
    const who = String(row.display_name || "") || String(row.handle || "") || "-";
    console.log(`  ${String(row.email).padEnd(34)} ${String(row.role).padEnd(8)} ${who}`);
  }
  console.log("\nPass an email to set its password:  npm run auth:password <email>");
}

async function main() {
  const email = normaliseEmail(process.argv[2] || "");
  if (!email) return listAccounts();

  const user = await findUserByEmail(email);
  if (!user) {
    console.error(`No account for ${email}.`);
    console.error("Run without arguments to list the accounts that exist.");
    process.exitCode = 1;
    return;
  }

  console.log(`Account: ${user.email}  (${user.role}${user.handle ? `, ${user.handle}` : ""})`);
  const password = await promptHidden("New password: ");
  const confirm = await promptHidden("Confirm:      ");

  if (password !== confirm) {
    console.error("Those did not match. Nothing was changed.");
    process.exitCode = 1;
    return;
  }

  const problem = passwordProblem(password);
  if (problem) {
    console.error(problem);
    process.exitCode = 1;
    return;
  }

  await updatePasswordHash(user.id, await hashPassword(password));
  console.log(`\nPassword updated. Sign in at /${user.role}/login with ${user.email}.`);
}

main().catch((error: unknown) => {
  console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
