import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { OBJECTIVE_LABEL, projectCampaign, projectCreator, suggestRoster, trackTargets } from "../src/lib/campaign-metrics";
import { normaliseCampaign } from "../src/lib/marketplace";
import type { Campaign } from "../src/lib/marketplace";
import type { CreatorProfile } from "../src/lib/types";

function makeCreator(handle: string, followers: number, packagePrice?: number): CreatorProfile {
  return {
    name: handle,
    handle,
    bio: "",
    primaryNiche: "Skincare",
    secondaryNiches: [],
    topicsDiscussed: [],
    contentPillars: [],
    contentStyles: [],
    brandPersonality: [],
    publicFollowerCount: followers,
    estimatedAudience: { ageGroups: [], interests: [], geography: [], languages: [] },
    contentQuality: { imageQuality: "", videoQuality: "", editingQuality: "", brandingConsistency: "", postingConsistency: "" },
    postingBehaviour: { approximateFrequency: "", dominantFormat: "", captionStyle: "", hashtagUsage: "" },
    brandSafety: { profanityRisk: "", politicalContent: "", sensitiveTopics: "", adultContentIndicators: "", overallScore: 80 },
    previousCollaborations: { detectedSponsoredContent: [], mentionedBrands: [], productCategories: [] },
    pricing: { currency: "USD", packagePrice },
    summary: "",
    embeddingText: "",
    rawData: {}
  };
}

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return normaliseCampaign({ name: "Test", budget: 10_000, ...overrides });
}

describe("projectCreator cost", () => {
  it("uses the quoted price when the creator quoted one", () => {
    assert.equal(projectCreator(makeCreator("@a", 100_000, 90_000), makeCampaign(), 50_000).cost, 50_000);
  });

  it("falls back to the asking rate when the quote is 0 (a creator reached out to)", () => {
    // The bug: `quotedPrice ?? asking` kept the 0 and made invited creators
    // look free in the campaign plan. `|| asking` fixes it.
    assert.equal(projectCreator(makeCreator("@a", 100_000, 90_000), makeCampaign(), 0).cost, 90_000);
  });

  it("falls back to the asking rate when no quote is given at all", () => {
    assert.equal(projectCreator(makeCreator("@a", 100_000, 90_000), makeCampaign()).cost, 90_000);
  });

  it("sums committed spend across a mixed roster", () => {
    const roster = [
      { creator: makeCreator("@kiara", 500_000, 50_000), quotedPrice: 50_000 },
      { creator: makeCreator("@mamitha", 7_000_000, 25_000), quotedPrice: 0 },
      { creator: makeCreator("@deepika", 80_000_000, 90_000), quotedPrice: 0 }
    ];
    assert.equal(projectCampaign(makeCampaign(), roster).cost, 165_000);
  });
});

describe("projectCreator", () => {
  it("reaches a share of followers, not all of them", () => {
    const projection = projectCreator(makeCreator("@a", 100_000), makeCampaign({ deliverables: ["1 reel"] }));

    assert.ok(projection.reach > 0);
    assert.ok(projection.reach < 100_000, "reach should be a fraction of followers");
  });

  it("applies a lower reach rate to larger accounts", () => {
    const small = projectCreator(makeCreator("@small", 10_000), makeCampaign());
    const large = projectCreator(makeCreator("@large", 1_000_000), makeCampaign());

    const smallRate = small.reach / 10_000;
    const largeRate = large.reach / 1_000_000;
    assert.ok(smallRate > largeRate, "smaller accounts reach a larger share of their audience");
  });

  it("counts every deliverable in impressions", () => {
    const one = projectCreator(makeCreator("@a", 50_000), makeCampaign({ deliverables: ["1 reel"] }));
    const three = projectCreator(makeCreator("@a", 50_000), makeCampaign({ deliverables: ["1 reel", "Story set", "Carousel post"] }));

    assert.equal(three.impressions, one.impressions * 3);
  });

  it("grows unique reach more slowly than impressions across repeat posts", () => {
    const one = projectCreator(makeCreator("@a", 50_000), makeCampaign({ deliverables: ["1 reel"] }));
    const three = projectCreator(makeCreator("@a", 50_000), makeCampaign({ deliverables: ["1 reel", "Story set", "Carousel post"] }));

    assert.ok(three.reach > one.reach, "more posts reach more people");
    assert.ok(three.reach < three.impressions, "repeat exposure is not new people");
  });

  it("caps unique reach near the size of the creator's audience", () => {
    const many = makeCampaign({ deliverables: new Array(20).fill("1 reel") });
    const projection = projectCreator(makeCreator("@a", 10_000), many);

    assert.ok(projection.reach <= 10_000 * 1.5);
  });

  it("prefers the quoted price over the published rate", () => {
    const creator = makeCreator("@a", 10_000, 900);
    assert.equal(projectCreator(creator, makeCampaign()).cost, 900);
    assert.equal(projectCreator(creator, makeCampaign(), 400).cost, 400);
  });

  it("computes CPM from cost and reach", () => {
    const projection = projectCreator(makeCreator("@a", 10_000, 350), makeCampaign({ deliverables: ["1 reel"] }));
    // 10k followers at the nano reach rate of 0.35 is 3,500 reached.
    assert.equal(projection.reach, 3_500);
    assert.equal(projection.cpm, 100);
  });

  it("projects more conversions for a conversions objective than an awareness one", () => {
    const creator = makeCreator("@a", 500_000);
    const awareness = projectCreator(creator, makeCampaign({ objective: "awareness" }));
    const conversions = projectCreator(creator, makeCampaign({ objective: "conversions" }));

    assert.ok(conversions.conversions > awareness.conversions);
  });

  it("projects nothing for a creator with no audience", () => {
    const projection = projectCreator(makeCreator("@a", 0), makeCampaign());

    assert.equal(projection.reach, 0);
    assert.equal(projection.cpm, 0);
  });
});

describe("projectCampaign", () => {
  const campaign = makeCampaign({ budget: 5_000, deliverables: ["1 reel"] });
  const roster: Array<{ creator: CreatorProfile; quotedPrice?: number }> = [
    { creator: makeCreator("@a", 100_000, 2_000) },
    { creator: makeCreator("@b", 50_000, 1_000) }
  ];

  it("sums the roster", () => {
    const projection = projectCampaign(campaign, roster);
    const individual = roster.map((entry) => projectCreator(entry.creator, campaign, entry.quotedPrice));

    assert.equal(projection.reach, individual[0].reach + individual[1].reach);
    assert.equal(projection.cost, 3_000);
  });

  it("reports budget headroom", () => {
    const projection = projectCampaign(campaign, roster);

    assert.equal(projection.budgetRemaining, 2_000);
    assert.equal(projection.overBudget, false);
  });

  it("flags going over budget", () => {
    const projection = projectCampaign(makeCampaign({ budget: 1_000 }), roster);

    assert.equal(projection.overBudget, true);
    assert.ok(projection.budgetRemaining < 0);
  });

  it("returns zeroes for an empty roster", () => {
    const projection = projectCampaign(campaign, []);

    assert.equal(projection.reach, 0);
    assert.equal(projection.cost, 0);
    assert.equal(projection.cpm, 0);
    assert.equal(projection.cpa, 0);
  });

  it("computes an engagement rate as a percentage of reach", () => {
    const projection = projectCampaign(campaign, roster);
    assert.ok(projection.engagementRate > 0 && projection.engagementRate < 100);
  });
});

describe("trackTargets", () => {
  const campaign = makeCampaign({ budget: 5_000, deliverables: ["1 reel"] });
  const roster = [{ creator: makeCreator("@a", 100_000, 2_000) }];
  const projection = projectCampaign(campaign, roster);

  it("returns nothing when no targets are set", () => {
    assert.deepEqual(trackTargets(undefined, projection), []);
    assert.deepEqual(trackTargets({}, projection), []);
  });

  it("marks a reach target met when the projection clears it", () => {
    const [progress] = trackTargets({ reach: 1_000 }, projection);

    assert.equal(progress.metric, "reach");
    assert.equal(progress.met, true);
    assert.ok(progress.ratio >= 1);
  });

  it("marks a reach target missed when the projection falls short", () => {
    const [progress] = trackTargets({ reach: 10_000_000 }, projection);

    assert.equal(progress.met, false);
    assert.ok(progress.ratio < 1);
  });

  it("treats CPM as lower-is-better", () => {
    const [progress] = trackTargets({ cpmTarget: 1_000 }, projection);

    assert.equal(progress.lowerIsBetter, true);
    assert.equal(progress.met, true, "a projected CPM under the ceiling is a hit");
  });

  it("does not count an empty roster as meeting a CPM target", () => {
    const empty = projectCampaign(campaign, []);
    const [progress] = trackTargets({ cpmTarget: 10 }, empty);

    assert.equal(progress.met, false);
  });

  it("tracks several targets at once", () => {
    const progress = trackTargets({ reach: 1_000, conversions: 1, cpmTarget: 500 }, projection);
    assert.deepEqual(progress.map((item) => item.metric), ["reach", "conversions", "cpmTarget"]);
  });
});

describe("suggestRoster", () => {
  const cheap = makeCreator("@cheap", 100_000, 500);
  const pricey = makeCreator("@pricey", 100_000, 4_000);

  it("prefers the lower CPM first", () => {
    const campaign = makeCampaign({ budget: 10_000, targets: { reach: 1_000 } });
    const chosen = suggestRoster(campaign, [{ creator: pricey }, { creator: cheap }]);

    assert.equal(chosen[0].creator.handle, "@cheap");
  });

  it("stays inside the budget", () => {
    const campaign = makeCampaign({ budget: 1_000, targets: { reach: 10_000_000 } });
    const chosen = suggestRoster(campaign, [{ creator: pricey }, { creator: cheap }]);
    const projection = projectCampaign(campaign, chosen);

    assert.ok(projection.cost <= 1_000);
    assert.equal(projection.overBudget, false);
  });

  it("stops once the reach target is covered", () => {
    const campaign = makeCampaign({ budget: 100_000, targets: { reach: 1 } });
    const chosen = suggestRoster(campaign, [{ creator: cheap }, { creator: pricey }]);

    assert.equal(chosen.length, 1);
  });

  it("skips creators with no projected reach", () => {
    const campaign = makeCampaign({ budget: 10_000 });
    const chosen = suggestRoster(campaign, [{ creator: makeCreator("@empty", 0, 100) }]);

    assert.deepEqual(chosen, []);
  });
});

describe("objective labels", () => {
  it("names every objective", () => {
    for (const objective of ["awareness", "engagement", "traffic", "conversions", "ugc"] as const) {
      assert.ok(OBJECTIVE_LABEL[objective]);
    }
  });
});
