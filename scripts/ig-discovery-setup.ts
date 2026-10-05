/**
 * Walks the Instagram Business Discovery setup and proves it works.
 *
 *   npm run ig:setup                 # find the lens account id, check the token
 *   npm run ig:setup cristiano       # ...and look that creator up
 *
 * Needs SOCIAFLUX_INSTAGRAM_DISCOVERY_TOKEN in .env.local. It prints the user
 * id to set as SOCIAFLUX_INSTAGRAM_DISCOVERY_USER_ID, so run it before filling
 * that one in.
 */

import { discoveryFields, discoveryUsername, parseDiscoveryResponse } from "../src/lib/instagram/discovery";

const GRAPH = "https://graph.facebook.com/v21.0";

async function graph(path: string, params: Record<string, string>) {
  const query = new URLSearchParams({ ...params, access_token: token });
  const response = await fetch(`${GRAPH}/${path}?${query.toString()}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (body as { error?: { message?: string } }).error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return body as Record<string, unknown>;
}

const token = process.env.SOCIAFLUX_INSTAGRAM_DISCOVERY_TOKEN?.trim() || "";
const configuredUserId = process.env.SOCIAFLUX_INSTAGRAM_DISCOVERY_USER_ID?.trim() || "";

async function main() {
  if (!token) {
    console.error("SOCIAFLUX_INSTAGRAM_DISCOVERY_TOKEN is not set in .env.local.");
    console.error("Generate one in Graph API Explorer with instagram_basic, pages_show_list and pages_read_engagement.");
    process.exitCode = 1;
    return;
  }

  console.log("1. Checking the token\n");
  const me = await graph("me", { fields: "id,name" });
  console.log(`   token belongs to : ${me.name} (${me.id})`);

  // A token that never expires is a Page token; a dated one is a user token
  // and will need renewing. Worth saying which, because the difference is the
  // whole maintenance story.
  const debug = (await graph("debug_token", { input_token: token })).data as Record<string, unknown> | undefined;
  const expiresAt = Number(debug?.expires_at) || 0;
  console.log(`   token type       : ${debug?.type || "unknown"}`);
  console.log(`   expires          : ${expiresAt === 0 ? "never (this is what you want)" : new Date(expiresAt * 1000).toISOString()}`);
  const scopes = Array.isArray(debug?.scopes) ? (debug.scopes as string[]) : [];
  console.log(`   scopes           : ${scopes.join(", ") || "none reported"}`);
  for (const required of ["instagram_basic", "pages_show_list"]) {
    if (!scopes.includes(required)) console.log(`   WARNING: missing scope ${required}`);
  }

  console.log("\n2. Finding the Instagram account linked to your Facebook Page\n");

  // A Page token's `me` is the Page itself and has no `accounts` edge, so the
  // user-token path throws. That is fine: once the lens id is configured the
  // Page lookup is only a convenience, so a Page token skips straight to it.
  let lensUserId = "";
  if (debug?.type === "PAGE") {
    console.log("   Page token in use; the lens id comes from configuration rather than discovery.");
    if (!configuredUserId) {
      console.log("\n   SOCIAFLUX_INSTAGRAM_DISCOVERY_USER_ID is not set. Run `npm run ig:token`,");
      console.log("   which writes both the Page token and the id, then re-run.");
      process.exitCode = 1;
      return;
    }
  } else {
    const pages = (await graph("me/accounts", { fields: "name,instagram_business_account{id,username}" })).data as
      | Array<{ name?: string; instagram_business_account?: { id?: string; username?: string } }>
      | undefined;

    if (!pages?.length) {
      console.log("   No Facebook Pages on this account. Create a Page and link your Instagram");
      console.log("   professional account to it (Instagram app > Settings > Accounts Centre).");
      process.exitCode = 1;
      return;
    }

    for (const page of pages) {
      const ig = page.instagram_business_account;
      console.log(`   Page "${page.name}" -> ${ig?.id ? `@${ig.username} (${ig.id})` : "no Instagram account linked"}`);
      if (ig?.id && !lensUserId) lensUserId = ig.id;
    }

    if (!lensUserId && !configuredUserId) {
      console.log("\n   None of your Pages has an Instagram account linked yet. Link one, then re-run.");
      process.exitCode = 1;
      return;
    }

    if (lensUserId) {
      console.log(`\n   Set this in .env.local and Vercel:\n   SOCIAFLUX_INSTAGRAM_DISCOVERY_USER_ID="${lensUserId}"`);
      if (configuredUserId && configuredUserId !== lensUserId) {
        console.log(`   (currently set to ${configuredUserId})`);
      }
    }
  }

  const target = process.argv[2];
  if (!target) {
    console.log("\nPass a handle to test a lookup, for example: npm run ig:setup cristiano");
    return;
  }

  const username = discoveryUsername(target);
  if (!username) {
    console.error(`\n"${target}" is not a valid Instagram handle.`);
    process.exitCode = 1;
    return;
  }

  console.log(`\n3. Looking up @${username}\n`);
  const body = await graph(configuredUserId || lensUserId, { fields: discoveryFields(username) });
  const profile = parseDiscoveryResponse(body);

  if (!profile) {
    console.log("   Instagram returned nothing. That normally means the account is private,");
    console.log("   personal rather than professional, or does not exist.");
    process.exitCode = 1;
    return;
  }

  console.log(`   name       : ${profile.name || "-"}`);
  console.log(`   followers  : ${profile.followersCount.toLocaleString()}`);
  console.log(`   following  : ${profile.followsCount.toLocaleString()}`);
  console.log(`   posts      : ${profile.mediaCount.toLocaleString()}`);
  console.log(`   avg likes  : ${profile.avgLikes?.toLocaleString() ?? "-"} (over ${profile.sampleSize} posts)`);
  console.log(`   avg comment: ${profile.avgComments?.toLocaleString() ?? "-"}`);
  console.log("\n   Business Discovery is working.");
}

main().catch((error: unknown) => {
  console.error(`\nFailed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
