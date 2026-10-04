import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MATCH_WEIGHTS,
  eligibleForCampaign,
  filterEligibleCreators,
  intersectTags,
  matchCreatorToCampaign,
  rankCampaignsForCreator,
  rankCreatorsForCampaign,
  scoreBarter,
  scoreRegion,
  scoreTags
} from "../src/lib/campaign-matching";
import { normaliseCampaign } from "../src/lib/marketplace";
import { createRegion } from "../src/lib/regions";
import type { Campaign } from "../src/lib/marketplace";
import type { CreatorProfile } from "../src/lib/types";

function makeCreator(overrides: Partial<CreatorProfile> = {}): CreatorProfile {
  return {
    name: "Test Creator",
    handle: "@test",
    bio: "",
    primaryNiche: "Skincare",
    subNiches: [],
    secondaryNiches: [],
    topicsDiscussed: [],
    contentPillars: [],
    contentStyles: [],
    brandPersonality: [],
    publicFollowerCount: 50_000,
    estimatedAudience: { ageGroups: [], interests: [], geography: [], languages: [] },
    contentQuality: {
      imageQuality: "",
      videoQuality: "",
      editingQuality: "",
      brandingConsistency: "",
      postingConsistency: ""
    },
    postingBehaviour: { approximateFrequency: "", dominantFormat: "", captionStyle: "", hashtagUsage: "" },
    brandSafety: {
      profanityRisk: "",
      politicalContent: "",
      sensitiveTopics: "",
      adultContentIndicators: "",
      overallScore: 80
    },
    previousCollaborations: { detectedSponsoredContent: [], mentionedBrands: [], productCategories: [] },
    pricing: { currency: "USD" },
    summary: "",
    embeddingText: "",
    rawData: {},
    ...overrides
  };
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return normaliseCampaign({
    name: "Test campaign",
    product: "Serum",
    goal: "Awareness",
    audience: "Buyers",
    creatorType: "Niche creators",
    budget: 5000,
    targetNiches: ["Skincare"],
    ...overrides
  });
}

describe("intersectTags", () => {
  it("matches identical tags regardless of case and spacing", () => {
    assert.deepEqual(intersectTags(["Skincare"], ["  skincare "]), ["Skincare"]);
  });

  it("matches when a creator tag contains the campaign tag", () => {
    assert.deepEqual(intersectTags(["Skincare"], ["Skincare education"]), ["Skincare"]);
  });

  it("matches when the campaign tag contains the creator tag", () => {
    assert.deepEqual(intersectTags(["Clean beauty routines"], ["Clean beauty"]), ["Clean beauty routines"]);
  });

  it("returns nothing for unrelated tags", () => {
    assert.deepEqual(intersectTags(["Skincare"], ["Motorsport", "Cricket"]), []);
  });

  it("does not report the same campaign tag twice", () => {
    assert.deepEqual(intersectTags(["Skincare"], ["Skincare", "Skincare education"]), ["Skincare"]);
  });

  it("ignores blank tags", () => {
    assert.deepEqual(intersectTags(["", "  "], ["Skincare"]), []);
  });
});

describe("scoreTags", () => {
  it("awards full coverage plus the primary-niche bonus, capped at 1", () => {
    const creator = makeCreator({ primaryNiche: "Skincare" });
    const { tagScore, matchedTags, primaryNicheMatched } = scoreTags(makeCampaign({ targetNiches: ["Skincare"] }), creator);

    assert.equal(tagScore, 1);
    assert.deepEqual(matchedTags, ["Skincare"]);
    assert.equal(primaryNicheMatched, true);
  });

  it("scores partial coverage by the share of campaign tags matched", () => {
    const creator = makeCreator({ primaryNiche: "Cars", subNiches: ["Skincare"] });
    const campaign = makeCampaign({ targetNiches: ["Skincare", "Makeup", "Haircare", "Fragrance"] });

    // 1 of 4 tags matched, primary niche ("Cars") not among them.
    assert.equal(scoreTags(campaign, creator).tagScore, 0.25);
  });

  it("adds the primary-niche bonus on top of partial coverage", () => {
    const creator = makeCreator({ primaryNiche: "Skincare" });
    const campaign = makeCampaign({ targetNiches: ["Skincare", "Motorsport"] });

    // 1 of 2 tags matched (0.5) + 0.15 primary-niche bonus.
    assert.equal(scoreTags(campaign, creator).tagScore, 0.65);
  });

  it("scores zero when no tag overlaps", () => {
    const creator = makeCreator({ primaryNiche: "Motorsport" });
    assert.equal(scoreTags(makeCampaign({ targetNiches: ["Skincare"] }), creator).tagScore, 0);
  });

  it("reads free-form campaign tags alongside target niches", () => {
    const creator = makeCreator({ primaryNiche: "Cars", contentPillars: ["Budget builds"] });
    const campaign = makeCampaign({ targetNiches: [], tags: ["Budget builds"] });

    assert.deepEqual(scoreTags(campaign, creator).matchedTags, ["Budget builds"]);
    assert.equal(scoreTags(campaign, creator).tagScore, 1);
  });

  it("falls back to brief affinity when the campaign carries no tags", () => {
    const campaign = makeCampaign({ targetNiches: [], tags: [], creatorType: "skincare educators" });
    const aligned = makeCreator({ primaryNiche: "Skincare", topicsDiscussed: ["skincare"] });
    const unaligned = makeCreator({ primaryNiche: "Motorsport", topicsDiscussed: ["rally"] });

    assert.ok(scoreTags(campaign, aligned).tagScore > scoreTags(campaign, unaligned).tagScore);
  });
});

describe("scoreBarter", () => {
  const willing = makeCreator({ openForBarter: true });
  const unwilling = makeCreator({ openForBarter: false });
  const unset = makeCreator();

  it("ignores barter willingness for paid campaigns", () => {
    assert.equal(scoreBarter("paid", willing), 1);
    assert.equal(scoreBarter("paid", unwilling), 1);
  });

  it("prioritises barter-friendly creators on flexible campaigns", () => {
    assert.equal(scoreBarter("flexible", willing), 1);
    assert.equal(scoreBarter("flexible", unwilling), 0.5);
  });

  it("scores barter-only campaigns at zero for creators who are not open", () => {
    assert.equal(scoreBarter("barter_only", willing), 1);
    assert.equal(scoreBarter("barter_only", unwilling), 0);
  });

  it("defaults an unset flag to not open for barter", () => {
    assert.equal(scoreBarter("barter_only", unset), 0);
    assert.equal(scoreBarter("flexible", unset), 0.5);
  });
});

describe("barter filtering", () => {
  it("excludes creators who are not open to barter from barter-only campaigns", () => {
    const campaign = makeCampaign({ barterPolicy: "barter_only" });
    const result = matchCreatorToCampaign(makeCreator({ openForBarter: false }), campaign);

    assert.equal(result.eligible, false);
    assert.ok(result.exclusionReasons.some((reason) => reason.includes("barter")));
  });

  it("keeps barter-friendly creators eligible on barter-only campaigns", () => {
    const campaign = makeCampaign({ barterPolicy: "barter_only" });
    assert.equal(matchCreatorToCampaign(makeCreator({ openForBarter: true }), campaign).eligible, true);
  });

  it("never excludes on barter for flexible campaigns, only ranks lower", () => {
    const campaign = makeCampaign({ barterPolicy: "flexible" });
    const willing = matchCreatorToCampaign(makeCreator({ openForBarter: true }), campaign);
    const unwilling = matchCreatorToCampaign(makeCreator({ openForBarter: false }), campaign);

    assert.equal(willing.eligible, true);
    assert.equal(unwilling.eligible, true);
    assert.ok(willing.score > unwilling.score);
  });

  it("migrates a legacy acceptsBarter flag to the flexible policy", () => {
    const campaign = normaliseCampaign({ name: "Legacy", acceptsBarter: true });
    assert.equal(campaign.barterPolicy, "flexible");
  });

  it("defaults campaigns with no barter information to paid", () => {
    assert.equal(normaliseCampaign({ name: "Legacy" }).barterPolicy, "paid");
  });
});

describe("scoreRegion", () => {
  const bangalore = createRegion("IN", "Karnataka", "Bangalore")!;

  it("treats a campaign with no target regions as open", () => {
    const { regionScore, regionLevel } = scoreRegion(makeCampaign({ targetRegions: [] }), makeCreator({ location: bangalore }));
    assert.equal(regionScore, 1);
    assert.equal(regionLevel, "open");
  });

  it("fully satisfies a country-wide target for any creator in that country", () => {
    const campaign = makeCampaign({ targetRegions: [createRegion("IN")!] });
    const { regionScore, regionLevel } = scoreRegion(campaign, makeCreator({ location: bangalore }));

    assert.equal(regionScore, 1);
    assert.equal(regionLevel, "country");
  });

  it("fully satisfies a city target for a creator in that city", () => {
    const campaign = makeCampaign({ targetRegions: [createRegion("IN", undefined, "bangalore")!] });
    const { regionScore, regionLevel } = scoreRegion(campaign, makeCreator({ location: bangalore }));

    assert.equal(regionScore, 1);
    assert.equal(regionLevel, "city");
  });

  it("fully satisfies a state target for a creator in that state", () => {
    const campaign = makeCampaign({ targetRegions: [createRegion("IN", "Karnataka")!] });
    assert.equal(scoreRegion(campaign, makeCreator({ location: bangalore })).regionLevel, "state");
  });

  it("partially credits the right country but the wrong city", () => {
    const campaign = makeCampaign({ targetRegions: [createRegion("IN", undefined, "Mumbai")!] });
    const { regionScore, regionLevel } = scoreRegion(campaign, makeCreator({ location: bangalore }));

    assert.equal(regionScore, 0.5);
    assert.equal(regionLevel, "partial");
  });

  it("scores zero for a creator in a different country", () => {
    const campaign = makeCampaign({ targetRegions: [createRegion("IN")!] });
    const { regionScore, regionLevel } = scoreRegion(campaign, makeCreator({ location: createRegion("US", "California")! }));

    assert.equal(regionScore, 0);
    assert.equal(regionLevel, "none");
  });

  it("takes the best level across several targets", () => {
    const campaign = makeCampaign({ targetRegions: [createRegion("US")!, createRegion("IN", "Karnataka")!] });
    assert.equal(scoreRegion(campaign, makeCreator({ location: bangalore })).regionLevel, "state");
  });

  it("treats an unstated creator location as unknown rather than a mismatch", () => {
    const campaign = makeCampaign({ targetRegions: [createRegion("IN")!] });
    const { regionScore, regionLevel } = scoreRegion(campaign, makeCreator());

    assert.equal(regionScore, 0.5);
    assert.equal(regionLevel, "unknown");
  });

  it("accepts a country name as well as a code", () => {
    const campaign = makeCampaign({ targetRegions: [createRegion("India")!] });
    assert.equal(scoreRegion(campaign, makeCreator({ location: bangalore })).regionLevel, "country");
  });

  it("canonicalises raw country names supplied straight to normaliseCampaign", () => {
    // Regression: a city target posted as { country: "United States" } used to miss
    // a creator stored as { country: "US" }.
    const campaign = normaliseCampaign({
      name: "SF only",
      targetRegions: [{ country: "United States", city: "san francisco" }],
      regionRequirement: "required"
    });
    const creator = makeCreator({ location: createRegion("US", "California", "San Francisco")! });

    assert.equal(campaign.targetRegions?.[0].country, "US");
    assert.equal(scoreRegion(campaign, creator).regionLevel, "city");
    assert.equal(matchCreatorToCampaign(creator, campaign).eligible, true);
  });

  it("drops target regions with no country", () => {
    const campaign = normaliseCampaign({ name: "Bad region", targetRegions: [{ country: "" }] });
    assert.deepEqual(campaign.targetRegions, []);
  });
});

describe("region filtering", () => {
  const campaignTargets = [createRegion("IN")!];

  it("keeps out-of-region creators eligible when regions are only preferred", () => {
    const campaign = makeCampaign({ targetRegions: campaignTargets, regionRequirement: "preferred" });
    const result = matchCreatorToCampaign(makeCreator({ location: createRegion("US")! }), campaign);

    assert.equal(result.eligible, true);
    assert.equal(result.breakdown.regionScore, 0);
  });

  it("excludes out-of-region creators when regions are required", () => {
    const campaign = makeCampaign({ targetRegions: campaignTargets, regionRequirement: "required" });
    const result = matchCreatorToCampaign(makeCreator({ location: createRegion("US")! }), campaign);

    assert.equal(result.eligible, false);
    assert.ok(result.exclusionReasons.some((reason) => reason.includes("target regions")));
  });

  it("excludes creators with no stated location when regions are required", () => {
    const campaign = makeCampaign({ targetRegions: campaignTargets, regionRequirement: "required" });
    const result = matchCreatorToCampaign(makeCreator(), campaign);

    assert.equal(result.eligible, false);
    assert.ok(result.exclusionReasons.some((reason) => reason.includes("not set a location")));
  });

  it("lets a caller require region matching for a preferred campaign", () => {
    const campaign = makeCampaign({ targetRegions: campaignTargets, regionRequirement: "preferred" });
    const creator = makeCreator({ location: createRegion("US")! });

    assert.equal(matchCreatorToCampaign(creator, campaign).eligible, true);
    assert.equal(matchCreatorToCampaign(creator, campaign, { requireRegionMatch: true }).eligible, false);
  });

  it("defaults the region requirement to preferred", () => {
    assert.equal(normaliseCampaign({ name: "Legacy" }).regionRequirement, "preferred");
  });
});

describe("minimum follower filtering", () => {
  it("excludes creators below the follower floor", () => {
    const campaign = makeCampaign({ minFollowers: 100_000 });
    const result = matchCreatorToCampaign(makeCreator({ publicFollowerCount: 20_000 }), campaign);

    assert.equal(result.eligible, false);
    assert.ok(result.exclusionReasons.some((reason) => reason.includes("followers")));
  });

  it("keeps creators at or above the follower floor", () => {
    const campaign = makeCampaign({ minFollowers: 20_000 });
    assert.equal(matchCreatorToCampaign(makeCreator({ publicFollowerCount: 20_000 }), campaign).eligible, true);
  });
});

describe("weighted score", () => {
  it("combines the three criteria using the published weights", () => {
    const campaign = makeCampaign({
      targetNiches: ["Skincare", "Motorsport"],
      targetRegions: [createRegion("IN", undefined, "Mumbai")!],
      barterPolicy: "flexible"
    });
    const creator = makeCreator({
      primaryNiche: "Skincare",
      location: createRegion("IN", "Karnataka", "Bangalore")!,
      openForBarter: false
    });

    // tag 0.5+0.15 bonus, region 0.5 (partial), barter 0.5 (flexible, not open).
    const expected = Math.round(100 * (MATCH_WEIGHTS.tag * 0.65 + MATCH_WEIGHTS.region * 0.5 + MATCH_WEIGHTS.barter * 0.5));
    assert.equal(matchCreatorToCampaign(creator, campaign).score, expected);
  });

  it("scores a perfect match at 100", () => {
    const campaign = makeCampaign({
      targetNiches: ["Skincare"],
      targetRegions: [createRegion("IN")!],
      barterPolicy: "barter_only"
    });
    const creator = makeCreator({ primaryNiche: "Skincare", location: createRegion("IN")!, openForBarter: true });

    assert.equal(matchCreatorToCampaign(creator, campaign).score, 100);
  });

  it("weights tag overlap above region, and region above barter", () => {
    assert.ok(MATCH_WEIGHTS.tag > MATCH_WEIGHTS.region);
    assert.ok(MATCH_WEIGHTS.region > MATCH_WEIGHTS.barter);
    assert.equal(MATCH_WEIGHTS.tag + MATCH_WEIGHTS.region + MATCH_WEIGHTS.barter, 1);
  });

  it("stays within 0..100", () => {
    const campaign = makeCampaign({ targetNiches: ["Motorsport"], targetRegions: [createRegion("US")!] });
    const score = matchCreatorToCampaign(makeCreator({ primaryNiche: "Skincare", location: createRegion("IN")! }), campaign).score;

    assert.ok(score >= 0 && score <= 100);
  });

  it("explains the positives behind a match", () => {
    const campaign = makeCampaign({ targetNiches: ["Skincare"], barterPolicy: "flexible" });
    const creator = makeCreator({ primaryNiche: "Skincare", openForBarter: true });
    const { reasons } = matchCreatorToCampaign(creator, campaign);

    assert.ok(reasons.some((reason) => reason.includes("Skincare")));
    assert.ok(reasons.some((reason) => reason.includes("barter")));
  });
});

describe("ranking", () => {
  const campaign = makeCampaign({
    targetNiches: ["Skincare"],
    targetRegions: [createRegion("IN")!],
    barterPolicy: "flexible",
    minFollowers: 10_000
  });

  const ideal = makeCreator({
    handle: "@ideal",
    primaryNiche: "Skincare",
    location: createRegion("IN", "Karnataka", "Bangalore")!,
    openForBarter: true
  });
  const paidOnly = makeCreator({
    handle: "@paidonly",
    primaryNiche: "Skincare",
    location: createRegion("IN")!,
    openForBarter: false
  });
  const wrongRegion = makeCreator({
    handle: "@wrongregion",
    primaryNiche: "Skincare",
    location: createRegion("US")!,
    openForBarter: true
  });
  const tooSmall = makeCreator({
    handle: "@toosmall",
    primaryNiche: "Skincare",
    location: createRegion("IN")!,
    openForBarter: true,
    publicFollowerCount: 500
  });

  it("orders creators by score", () => {
    const ranked = rankCreatorsForCampaign([wrongRegion, paidOnly, ideal], campaign);
    assert.deepEqual(ranked.map((match) => match.creatorHandle), ["@ideal", "@paidonly", "@wrongregion"]);
  });

  it("sorts ineligible creators last regardless of score", () => {
    const ranked = rankCreatorsForCampaign([tooSmall, wrongRegion], campaign);

    assert.equal(ranked[0].creatorHandle, "@wrongregion");
    assert.equal(ranked[1].creatorHandle, "@toosmall");
    assert.equal(ranked[1].eligible, false);
  });

  it("filters to eligible creators only", () => {
    const eligible = filterEligibleCreators([ideal, tooSmall], campaign);
    assert.deepEqual(eligible.map((creator) => creator.handle), ["@ideal"]);
  });

  it("ranks campaigns for a creator from the same engine", () => {
    const strong = makeCampaign({ id: "strong", name: "Strong", targetNiches: ["Skincare"], targetRegions: [createRegion("IN")!] });
    const weak = makeCampaign({ id: "weak", name: "Weak", targetNiches: ["Motorsport"], targetRegions: [createRegion("US")!] });
    const ranked = rankCampaignsForCreator([weak, strong], ideal);

    assert.deepEqual(ranked.map((entry) => entry.campaign.id), ["strong", "weak"]);
  });

  it("reports the same eligibility through the thin helper", () => {
    assert.deepEqual(eligibleForCampaign(ideal, campaign), { eligible: true, reasons: [] });
    assert.equal(eligibleForCampaign(tooSmall, campaign).eligible, false);
  });
});
