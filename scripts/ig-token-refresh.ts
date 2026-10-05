/**
 * Turns the short-lived Facebook token from Graph API Explorer into a Page
 * token that never expires, and writes it back to .env.local.
 *
 *   npm run ig:token
 *
 * The chain Meta requires is:
 *   short-lived user token  --fb_exchange_token-->  long-lived user token (60d)
 *   long-lived user token   --/me/accounts------->  Page token (no expiry)
 *
 * The last step is the point: a Page token derived from a long-lived user token
 * does not expire, so this is a thing you run once rather than every 60 days.
 * Derive it from a short-lived token instead and you get a short-lived Page
 * token, which is the usual way people end up re-doing this monthly.
 *
 * Needs SOCIAFLUX_FACEBOOK_APP_ID and SOCIAFLUX_FACEBOOK_APP_SECRET — the app's
 * own credentials from Meta app > Settings > Basic. These are NOT the same as
 * SOCIAFLUX_INSTAGRAM_APP_ID, which is the "IG App ID" shown under the
 * Instagram product and is a different number.
 *
 * The token is never printed. It goes straight into .env.local.
 */

import { readFileSync, writeFileSync } from "node:fs";

const GRAPH = "https://graph.facebook.com/v21.0";
const ENV_PATH = ".env.local";
const TOKEN_KEY = "SOCIAFLUX_INSTAGRAM_DISCOVERY_TOKEN";
const USER_ID_KEY = "SOCIAFLUX_INSTAGRAM_DISCOVERY_USER_ID";

async function graph(path: string, params: Record<string, string>) {
  const response = await fetch(`${GRAPH}/${path}?${new URLSearchParams(params).toString()}`);
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const message = (body as { error?: { message?: string } }).error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body;
}

/** Rewrites one key in place, so comments and ordering survive. */
function writeEnvValue(key: string, value: string) {
  let contents = readFileSync(ENV_PATH, "utf8");
  const line = `${key}="${value}"`;
  const existing = new RegExp(`^[ \\t]*${key}[ \\t]*=.*$`, "m");

  if (existing.test(contents)) {
    contents = contents.replace(existing, line);
  } else {
    if (!contents.endsWith("\n")) contents += "\n";
    contents += `${line}\n`;
  }

  writeFileSync(ENV_PATH, contents);
}

async function describe(token: string) {
  const data = (await graph("debug_token", { input_token: token, access_token: token })).data as Record<string, unknown> | undefined;
  const expiresAt = Number(data?.expires_at) || 0;
  return {
    type: String(data?.type || "unknown"),
    expiry: expiresAt === 0 ? "never" : new Date(expiresAt * 1000).toISOString()
  };
}

async function main() {
  const appId = process.env.SOCIAFLUX_FACEBOOK_APP_ID?.trim() || "";
  const appSecret = process.env.SOCIAFLUX_FACEBOOK_APP_SECRET?.trim() || "";
  const current = process.env[TOKEN_KEY]?.trim() || "";

  if (!current) {
    console.error(`${TOKEN_KEY} is not set in ${ENV_PATH}.`);
    process.exitCode = 1;
    return;
  }
  if (!appId || !appSecret) {
    console.error("SOCIAFLUX_FACEBOOK_APP_ID and SOCIAFLUX_FACEBOOK_APP_SECRET must be set in .env.local.");
    console.error("Find them under Meta app > App settings > Basic (App ID and App secret).");
    console.error('Note these differ from SOCIAFLUX_INSTAGRAM_APP_ID, which is the "IG App ID".');
    process.exitCode = 1;
    return;
  }

  const before = await describe(current);
  console.log(`Current token: ${before.type}, expires ${before.expiry}`);
  if (before.type === "PAGE" && before.expiry === "never") {
    console.log("\nAlready a permanent Page token. Nothing to do.");
    return;
  }

  console.log("\n1. Exchanging for a long-lived user token");
  const longLived = String(
    (
      await graph("oauth/access_token", {
        grant_type: "fb_exchange_token",
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: current
      })
    ).access_token || ""
  );
  if (!longLived) throw new Error("Facebook did not return a long-lived token.");
  console.log(`   done: expires ${(await describe(longLived)).expiry}`);

  console.log("\n2. Deriving the Page token");
  const pages = (await graph("me/accounts", { fields: "name,access_token,instagram_business_account{id,username}", access_token: longLived })).data as
    | Array<{ name?: string; access_token?: string; instagram_business_account?: { id?: string; username?: string } }>
    | undefined;

  const page = pages?.find((candidate) => candidate.instagram_business_account?.id && candidate.access_token);
  if (!page?.access_token) {
    console.error("   No Page with a linked Instagram account and a usable token.");
    console.error("   Link your Instagram professional account to a Facebook Page, then re-run.");
    process.exitCode = 1;
    return;
  }

  const after = await describe(page.access_token);
  console.log(`   Page "${page.name}" -> @${page.instagram_business_account?.username}`);
  console.log(`   token type ${after.type}, expires ${after.expiry}`);

  writeEnvValue(TOKEN_KEY, page.access_token);
  if (page.instagram_business_account?.id) writeEnvValue(USER_ID_KEY, page.instagram_business_account.id);
  console.log(`\n   Written to ${ENV_PATH}.`);

  if (after.expiry !== "never") {
    console.log("\n   WARNING: this Page token still has an expiry. That normally means the");
    console.log("   user token was not long-lived. Re-run, or regenerate in Graph API Explorer.");
  }

  console.log("\n3. Checking Business Discovery still works");
  const probe = await graph(page.instagram_business_account!.id!, {
    fields: "business_discovery.username(cristiano){username,followers_count}",
    access_token: page.access_token
  });
  const discovered = (probe as { business_discovery?: { username?: string; followers_count?: number } }).business_discovery;
  console.log(discovered ? `   @${discovered.username}: ${discovered.followers_count?.toLocaleString()} followers. Working.` : "   No result.");

  console.log("\nCopy the same two values into Vercel's environment variables.");
}

main().catch((error: unknown) => {
  console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
