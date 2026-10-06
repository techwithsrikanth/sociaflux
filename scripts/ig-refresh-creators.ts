/**
 * Refreshes stored creator metrics from Business Discovery.
 *
 *   npm run ig:refresh            # update every creator that resolves
 *   npm run ig:refresh mamitha    # just one
 *
 * A profile analysed while the discovery token was dead was saved with
 * "Unknown" counts, and nothing re-fetches it on its own. This pulls fresh
 * numbers and writes back ONLY the public metrics — follower, following and
 * post counts, and measured average likes and comments. Niches, languages,
 * contact details and everything the creator set by hand are left untouched.
 */

import { listCreators, saveCreator } from "../src/lib/db/repositories";
import { discoverInstagramProfile } from "../src/lib/instagram/discovery";
import type { CreatorProfile } from "../src/lib/types";

async function main() {
  const only = (process.argv[2] || "").replace(/^@/, "").toLowerCase();
  const creators = await listCreators();
  const targets = only ? creators.filter((c) => c.handle.replace(/^@/, "").toLowerCase() === only) : creators;

  if (!targets.length) {
    console.log(only ? `No stored creator matches @${only}.` : "No creators stored.");
    return;
  }

  let updated = 0;
  for (const creator of targets) {
    const profile = await discoverInstagramProfile(creator.handle);
    if (!profile) {
      console.log(`  skip   ${creator.handle} — not resolvable (private, personal, or token/handle issue)`);
      continue;
    }

    const next: CreatorProfile = {
      ...creator,
      publicFollowerCount: profile.followersCount,
      publicFollowingCount: profile.followsCount,
      publicPostCount: profile.mediaCount,
      publicAvgLikes: profile.avgLikes ?? creator.publicAvgLikes,
      publicAvgComments: profile.avgComments ?? creator.publicAvgComments
    };
    await saveCreator(next);
    updated += 1;
    console.log(`  ok     ${creator.handle} — ${profile.followersCount.toLocaleString()} followers, ${profile.mediaCount} posts`);
  }

  console.log(`\nRefreshed ${updated} of ${targets.length} creator(s).`);
}

main().catch((error: unknown) => {
  console.error(`Failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
