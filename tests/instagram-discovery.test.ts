import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MEDIA_SAMPLE_SIZE,
  discoveryFields,
  discoveryToScrapeResult,
  discoveryUsername,
  parseDiscoveryResponse
} from "../src/lib/instagram/discovery";

function body(discovery: Record<string, unknown> | null) {
  return discovery === null ? {} : { business_discovery: discovery };
}

describe("discoveryUsername", () => {
  it("accepts a bare handle, an @handle and a profile URL", () => {
    assert.equal(discoveryUsername("cristiano"), "cristiano");
    assert.equal(discoveryUsername("@Cristiano"), "cristiano");
    assert.equal(discoveryUsername("https://instagram.com/cristiano"), "cristiano");
    assert.equal(discoveryUsername("https://www.instagram.com/mamitha_baiju/"), "mamitha_baiju");
  });

  it("keeps dots and underscores, which are legal in handles", () => {
    assert.equal(discoveryUsername("@billionaire__vision1"), "billionaire__vision1");
    assert.equal(discoveryUsername("leo.messi"), "leo.messi");
  });

  it("rejects anything that could break out of the field expression", () => {
    // The username is interpolated into business_discovery.username(...), so a
    // brace or paren must never survive validation.
    assert.equal(discoveryUsername("@bad){followers_count"), null);
    assert.equal(discoveryUsername("@with space"), null);
    assert.equal(discoveryUsername("@" + "a".repeat(31)), null);
  });
});

describe("discoveryFields", () => {
  it("asks for the metrics the profile card needs", () => {
    const fields = discoveryFields("cristiano");
    assert.match(fields, /^business_discovery\.username\(cristiano\)\{/);
    for (const field of ["followers_count", "follows_count", "media_count", "biography", "profile_picture_url"]) {
      assert.ok(fields.includes(field), `expected ${field}`);
    }
    assert.ok(fields.includes(`media.limit(${MEDIA_SAMPLE_SIZE})`));
  });
});

describe("parseDiscoveryResponse", () => {
  it("returns null when the account was not discoverable", () => {
    assert.equal(parseDiscoveryResponse(body(null)), null);
    assert.equal(parseDiscoveryResponse(null), null);
    assert.equal(parseDiscoveryResponse({ business_discovery: {} }), null);
  });

  it("reads the public counts", () => {
    const profile = parseDiscoveryResponse(
      body({ username: "cristiano", name: "Cristiano Ronaldo", followers_count: 660000000, follows_count: 589, media_count: 3800 })
    );
    assert.ok(profile);
    assert.equal(profile.username, "cristiano");
    assert.equal(profile.followersCount, 660000000);
    assert.equal(profile.followsCount, 589);
    assert.equal(profile.mediaCount, 3800);
  });

  it("averages likes and comments over the returned media", () => {
    const profile = parseDiscoveryResponse(
      body({
        username: "cristiano",
        followers_count: 100,
        media: { data: [{ like_count: 10, comments_count: 2 }, { like_count: 20, comments_count: 4 }] }
      })
    );
    assert.equal(profile?.avgLikes, 15);
    assert.equal(profile?.avgComments, 3);
    assert.equal(profile?.sampleSize, 2);
  });

  it("averages only over posts that reported the field", () => {
    // Instagram omits like_count on some posts rather than sending zero, and
    // counting those as zero would understate the creator badly.
    const profile = parseDiscoveryResponse(
      body({ username: "a", media: { data: [{ like_count: 100, comments_count: 10 }, { comments_count: 20 }] } })
    );
    assert.equal(profile?.avgLikes, 100);
    assert.equal(profile?.avgComments, 15);
    assert.equal(profile?.sampleSize, 2);
  });

  it("leaves the averages undefined when no media came back", () => {
    const profile = parseDiscoveryResponse(body({ username: "a", followers_count: 10 }));
    assert.equal(profile?.avgLikes, undefined);
    assert.equal(profile?.avgComments, undefined);
    assert.equal(profile?.sampleSize, 0);
  });
});

describe("discoveryToScrapeResult", () => {
  const profile = {
    username: "cristiano",
    name: "Cristiano Ronaldo",
    biography: "SIUUUbscribe",
    website: "https://cristianoronaldo.com",
    profilePictureUrl: "https://cdn.example/pic.jpg",
    followersCount: 660000000,
    followsCount: 589,
    mediaCount: 3800,
    avgLikes: 4200000,
    avgComments: 31000,
    sampleSize: 12
  };

  it("writes the counts in the form the analysis provider parses", () => {
    const scrape = discoveryToScrapeResult(profile);
    assert.equal(scrape.status, "complete");
    assert.match(scrape.textSample, /Followers: 660000000/);
    assert.match(scrape.textSample, /Following: 589/);
    assert.match(scrape.textSample, /Posts: 3800/);
    assert.match(scrape.textSample, /Average likes: 4200000/);
    assert.match(scrape.textSample, /Average comments: 31000/);
  });

  it("carries the identity fields across", () => {
    const scrape = discoveryToScrapeResult(profile);
    assert.equal(scrape.title, "Cristiano Ronaldo (@cristiano)");
    assert.equal(scrape.description, "SIUUUbscribe");
    assert.equal(scrape.sourceUrl, "https://www.instagram.com/cristiano/");
    assert.ok(scrape.links.includes("https://cristianoronaldo.com"));
    assert.deepEqual(scrape.images, ["https://cdn.example/pic.jpg"]);
  });

  it("says the engagement is estimated when no posts were returned", () => {
    const scrape = discoveryToScrapeResult({ ...profile, avgLikes: undefined, avgComments: undefined, sampleSize: 0 });
    assert.ok(scrape.limitations.some((line) => /estimated from follower count/i.test(line)));
    assert.ok(!/Average likes/.test(scrape.textSample));
  });

  it("falls back to the username when Instagram has no display name", () => {
    const scrape = discoveryToScrapeResult({ ...profile, name: undefined });
    assert.equal(scrape.title, "cristiano (@cristiano)");
  });
});
