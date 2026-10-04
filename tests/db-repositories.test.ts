import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { closeDb, getDb, isRemoteDatabase } from "../src/lib/db/client";
import * as repositories from "../src/lib/db/repositories";
import { normaliseCampaign } from "../src/lib/marketplace";
import type { Application } from "../src/lib/marketplace";
import type { BusinessProfile, CreatorProfile } from "../src/lib/types";

// Point the client at a throwaway file database so these tests never touch the
// real Turso instance. Safe to do after the imports: the client reads the
// environment when getDb() is first called, not at import time.
const workdir = mkdtempSync(join(tmpdir(), "sociaflux-db-"));
process.env.SOCIAFLUX_TURSO_DATABASE_URL = `file:${join(workdir, "test.db").replace(/\\/g, "/")}`;
delete process.env.SOCIAFLUX_TURSO_AUTH_TOKEN;

function makeCreator(handle: string, overrides: Partial<CreatorProfile> = {}): CreatorProfile {
  return {
    name: handle.replace("@", ""),
    handle,
    bio: "",
    primaryNiche: "Skincare",
    subNiches: ["Dermatology"],
    contentLanguages: ["English"],
    secondaryNiches: [],
    topicsDiscussed: [],
    contentPillars: [],
    contentStyles: [],
    brandPersonality: [],
    publicFollowerCount: 42_000,
    estimatedAudience: { ageGroups: ["25-34"], interests: [], geography: [], languages: ["English"] },
    contentQuality: { imageQuality: "", videoQuality: "", editingQuality: "", brandingConsistency: "", postingConsistency: "" },
    postingBehaviour: { approximateFrequency: "", dominantFormat: "", captionStyle: "", hashtagUsage: "" },
    brandSafety: { profanityRisk: "", politicalContent: "", sensitiveTopics: "", adultContentIndicators: "", overallScore: 88 },
    previousCollaborations: { detectedSponsoredContent: [], mentionedBrands: [], productCategories: [] },
    pricing: { currency: "USD", packagePrice: 1_200 },
    summary: "Summary text",
    embeddingText: "",
    rawData: { note: "kept verbatim" },
    ...overrides
  };
}

function makeApplication(overrides: Partial<Application> = {}): Application {
  return {
    id: "app_1",
    campaignId: "cmp_1",
    campaignName: "Campaign one",
    creatorHandle: "@alpha",
    pitch: "My pitch",
    quotedPrice: 900,
    openToBarter: false,
    status: "applied",
    appliedAt: "2026-10-01T10:00:00.000Z",
    ...overrides
  };
}

before(async () => {
  const sql = readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  const statements = sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement && !statement.split("\n").every((line) => line.trim().startsWith("--")));
  for (const statement of statements) await getDb().execute(statement);
});

after(() => {
  closeDb();
  // Windows can still hold the file handle briefly; the temp dir is disposable.
  try {
    rmSync(workdir, { recursive: true, force: true });
  } catch {}
});

describe("client", () => {
  it("treats a file URL as local, not remote", () => {
    assert.equal(isRemoteDatabase(), false);
  });
});

describe("creators", () => {
  it("round-trips a profile including nested data", async () => {
    await repositories.saveCreator(makeCreator("@alpha"));
    const loaded = await repositories.getCreator("@alpha");

    assert.ok(loaded);
    assert.equal(loaded.handle, "@alpha");
    assert.equal(loaded.summary, "Summary text");
    assert.deepEqual(loaded.subNiches, ["Dermatology"]);
    assert.deepEqual(loaded.rawData, { note: "kept verbatim" });
    assert.equal(loaded.pricing.packagePrice, 1_200);
  });

  it("normalises the handle on write and read", async () => {
    await repositories.saveCreator(makeCreator("Beta"));
    assert.ok(await repositories.getCreator("@beta"));
    assert.ok(await repositories.getCreator("beta"));
  });

  it("upserts rather than duplicating", async () => {
    await repositories.saveCreator(makeCreator("@alpha", { name: "Alpha One" }));
    await repositories.saveCreator(makeCreator("@alpha", { name: "Alpha Two" }));
    const all = await repositories.listCreators();

    assert.equal(all.filter((creator) => creator.handle === "@alpha").length, 1);
    assert.equal((await repositories.getCreator("@alpha"))?.name, "Alpha Two");
  });

  it("stores the barter flag as a real boolean", async () => {
    await repositories.saveCreator(makeCreator("@barter", { openForBarter: true }));
    assert.equal((await repositories.getCreator("@barter"))?.openForBarter, true);
    assert.equal((await repositories.getCreator("@alpha"))?.openForBarter, false);
  });

  it("stores location as queryable columns", async () => {
    await repositories.saveCreator(makeCreator("@located", { location: { country: "IN", state: "Karnataka", city: "Bangalore" } }));
    const loaded = await repositories.getCreator("@located");

    assert.deepEqual(loaded?.location, { country: "IN", state: "Karnataka", city: "Bangalore" });
  });

  it("returns null for an unknown handle", async () => {
    assert.equal(await repositories.getCreator("@nobody"), null);
  });

  it("rejects a creator with no handle", async () => {
    await assert.rejects(() => repositories.saveCreator(makeCreator("")), /handle/i);
  });
});

describe("searchCreators", () => {
  before(async () => {
    await repositories.saveCreator(makeCreator("@fit", {
      primaryNiche: "Gym & strength",
      subNiches: ["Sports nutrition"],
      openForBarter: true,
      publicFollowerCount: 500_000,
      location: { country: "US", city: "Chicago" },
      pricing: { currency: "USD", packagePrice: 5_000 }
    }));
  });

  it("filters by niche across primary and sub niches", async () => {
    const byPrimary = await repositories.searchCreators({ niche: "gym" });
    assert.deepEqual(byPrimary.map((creator) => creator.handle), ["@fit"]);

    const bySub = await repositories.searchCreators({ niche: "sports nutrition" });
    assert.deepEqual(bySub.map((creator) => creator.handle), ["@fit"]);
  });

  it("filters by country and city", async () => {
    assert.deepEqual((await repositories.searchCreators({ country: "US" })).map((c) => c.handle), ["@fit"]);
    assert.deepEqual((await repositories.searchCreators({ city: "CHICAGO" })).map((c) => c.handle), ["@fit"]);
    assert.deepEqual(await repositories.searchCreators({ country: "ZZ" }), []);
  });

  it("filters by barter willingness", async () => {
    const handles = (await repositories.searchCreators({ openForBarter: true })).map((creator) => creator.handle);

    assert.ok(handles.includes("@fit"));
    assert.ok(!handles.includes("@alpha"));
  });

  it("filters by minimum followers", async () => {
    const big = await repositories.searchCreators({ minFollowers: 100_000 });
    assert.deepEqual(big.map((creator) => creator.handle), ["@fit"]);
  });

  it("filters by max price", async () => {
    const affordable = await repositories.searchCreators({ maxPrice: 2_000 });

    assert.ok(affordable.some((creator) => creator.handle === "@alpha"));
    assert.ok(!affordable.some((creator) => creator.handle === "@fit"));
  });

  it("sorts by followers descending", async () => {
    const all = await repositories.searchCreators({});
    const counts = all.map((creator) => creator.publicFollowerCount || 0);

    assert.deepEqual(counts, [...counts].sort((a, b) => b - a));
  });
});

describe("campaigns", () => {
  it("round-trips a campaign with nested targets, regions and assets", async () => {
    const campaign = normaliseCampaign({
      id: "cmp_1",
      name: "Campaign one",
      brandName: "Aura",
      budget: 5_000,
      objective: "conversions",
      targets: { reach: 100_000, cpmTarget: 15 },
      targetRegions: [{ country: "IN", city: "Bangalore" }],
      targetNiches: ["Skincare"],
      briefAssets: [{ id: "a1", kind: "image", url: "https://example.com/a.png", title: "Look", note: "Match this" }],
      barterPolicy: "flexible",
      regionRequirement: "required"
    });
    await repositories.saveCampaign(campaign, "aura");

    const loaded = await repositories.getCampaign("cmp_1");
    assert.ok(loaded);
    assert.equal(loaded.objective, "conversions");
    assert.deepEqual(loaded.targets, { reach: 100_000, cpmTarget: 15 });
    assert.deepEqual(loaded.targetRegions, [{ country: "IN", city: "Bangalore" }]);
    assert.equal(loaded.briefAssets?.[0].title, "Look");
    assert.equal(loaded.barterPolicy, "flexible");
    assert.equal(loaded.regionRequirement, "required");
  });

  it("upserts rather than duplicating", async () => {
    await repositories.saveCampaign({ id: "cmp_1", name: "Campaign one renamed", budget: 7_000 }, "aura");
    const all = await repositories.listCampaigns();

    assert.equal(all.filter((campaign) => campaign.id === "cmp_1").length, 1);
    assert.equal((await repositories.getCampaign("cmp_1"))?.budget, 7_000);
  });

  it("filters by brand", async () => {
    await repositories.saveCampaign({ id: "cmp_other", name: "Other brand campaign" }, "other");
    const aura = await repositories.listCampaigns({ brandId: "aura" });

    assert.ok(aura.every((campaign) => campaign.id !== "cmp_other"));
  });

  it("returns null for an unknown id", async () => {
    assert.equal(await repositories.getCampaign("cmp_missing"), null);
  });
});

describe("applications", () => {
  it("round-trips an application", async () => {
    const saved = await repositories.saveApplication(makeApplication());
    assert.equal(saved.id, "app_1");
    assert.equal(saved.openToBarter, false);

    const [loaded] = await repositories.listApplications({ campaignId: "cmp_1" });
    assert.equal(loaded.pitch, "My pitch");
    assert.equal(loaded.quotedPrice, 900);
  });

  it("keeps one application per creator per campaign and returns the stored row", async () => {
    // Re-applying with a fresh id must return the existing row's id, or the
    // caller would hold an id that does not exist.
    const second = await repositories.saveApplication(makeApplication({ id: "app_different", pitch: "Updated pitch", quotedPrice: 1_500 }));

    assert.equal(second.id, "app_1");
    assert.equal(second.pitch, "Updated pitch");

    const rows = await repositories.listApplications({ campaignId: "cmp_1" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quotedPrice, 1_500);
  });

  it("allows the same creator on a different campaign", async () => {
    await repositories.saveApplication(makeApplication({ id: "app_2", campaignId: "cmp_other", campaignName: "Other" }));
    const mine = await repositories.listApplications({ creatorHandle: "@alpha" });

    assert.equal(mine.length, 2);
  });

  it("filters by creator handle, normalising it", async () => {
    const byBare = await repositories.listApplications({ creatorHandle: "alpha" });
    assert.equal(byBare.length, 2);
  });

  it("records a decision with a timestamp", async () => {
    const updated = await repositories.setApplicationStatus("app_1", "approved", "Looks great");

    assert.equal(updated?.status, "approved");
    assert.equal(updated?.brandNote, "Looks great");
    assert.ok(updated?.decidedAt);
  });

  it("keeps an existing note when none is supplied", async () => {
    const updated = await repositories.setApplicationStatus("app_1", "shortlisted");
    assert.equal(updated?.brandNote, "Looks great");
  });

  it("returns null when deciding on an unknown application", async () => {
    assert.equal(await repositories.setApplicationStatus("app_missing", "approved"), null);
  });

  it("deletes an application", async () => {
    await repositories.deleteApplication("app_2");
    assert.equal((await repositories.listApplications({ creatorHandle: "@alpha" })).length, 1);
  });

  it("removes applications with their campaign", async () => {
    await repositories.deleteCampaign("cmp_1");

    assert.equal(await repositories.getCampaign("cmp_1"), null);
    assert.equal((await repositories.listApplications({ campaignId: "cmp_1" })).length, 0);
  });
});

describe("brands", () => {
  it("round-trips a business profile", async () => {
    const profile = {
      businessName: "Aura Atelier",
      website: "https://aura.example",
      industry: "Beauty",
      category: "Skincare",
      products: ["Serum"],
      targetAudience: ["Sensitive skin"]
    } as unknown as BusinessProfile;

    await repositories.saveBrand(profile, "aura");
    const loaded = await repositories.getBrand("aura");

    assert.equal(loaded?.businessName, "Aura Atelier");
    assert.deepEqual(loaded?.products, ["Serum"]);
  });

  it("returns null for an unknown brand", async () => {
    assert.equal(await repositories.getBrand("nobody"), null);
  });
});
