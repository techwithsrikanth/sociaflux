import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { brandProfileReady, buildProductPersonaText, campaignBudgetStatus, campaignsForBrand, creatorRate, defaultCampaignName, emptyBusinessProfile, resolveCampaignProduct } from "../src/lib/brand-flow";
import { normaliseCampaign } from "../src/lib/marketplace";
import type { Application, Campaign } from "../src/lib/marketplace";
import type { BusinessProfile, CreatorProfile } from "../src/lib/types";

function campaign(overrides: Partial<Campaign> = {}): Campaign {
  return normaliseCampaign({ name: "Launch campaign", product: "Hero product", ...overrides });
}

const profile = {
  businessName: "Vivo India",
  targetAudience: ["High-intent buyers"],
  uniqueSellingPoints: ["Camera quality"],
  primaryValueProposition: "Flagship cameras"
} as unknown as BusinessProfile;

describe("campaignsForBrand", () => {
  const all = [
    campaign({ id: "a", brandName: "Vivo India" }),
    campaign({ id: "b", brandName: "Samsung India" }),
    campaign({ id: "c", brandName: "Rolls Royce" })
  ];

  it("returns only the signed-in brand's campaigns", () => {
    // The whole point: a brand must not see another brand's campaigns or their
    // applicants in its own dashboard.
    const vivo = campaignsForBrand(all, "Vivo India");
    assert.deepEqual(vivo.map((c) => c.id), ["a"]);
  });

  it("matches brand names case- and spacing-insensitively", () => {
    assert.deepEqual(campaignsForBrand(all, "vivo india").map((c) => c.id), ["a"]);
    assert.deepEqual(campaignsForBrand(all, "  Samsung  India ").map((c) => c.id), ["b"]);
  });

  it("treats a campaign with no brand as owned, for legacy rows", () => {
    const withLegacy = [...all, campaign({ id: "legacy", brandName: "" })];
    assert.deepEqual(campaignsForBrand(withLegacy, "Vivo India").map((c) => c.id), ["a", "legacy"]);
  });

  it("returns everything when no brand is given rather than hiding all", () => {
    assert.equal(campaignsForBrand(all, "").length, 3);
  });
});

describe("resolveCampaignProduct", () => {
  it("prefers the typed product name over the placeholder", () => {
    assert.equal(resolveCampaignProduct(["Vivo V80"], campaign()), "Vivo V80");
  });

  it("never returns the Hero placeholder once a name is typed", () => {
    assert.notEqual(resolveCampaignProduct(["Vivo V80"], campaign({ product: "Hero product" })), "Hero product");
  });

  it("falls back to a chosen persona, then the campaign product", () => {
    assert.equal(resolveCampaignProduct([""], campaign({ product: "Hero product" }), "X100 Pro"), "X100 Pro");
    assert.equal(resolveCampaignProduct([""], campaign({ product: "Real Product" })), "Real Product");
  });

  it("trims surrounding whitespace", () => {
    assert.equal(resolveCampaignProduct(["  Vivo V80  "], campaign()), "Vivo V80");
  });
});

describe("defaultCampaignName", () => {
  it("replaces the default name with brand and product", () => {
    assert.equal(defaultCampaignName("Vivo India", "Vivo V80", "Launch campaign"), "Vivo India — Vivo V80");
  });

  it("keeps a name the brand actually chose", () => {
    assert.equal(defaultCampaignName("Vivo India", "Vivo V80", "Diwali push"), "Diwali push");
  });

  it("handles a missing current name", () => {
    assert.equal(defaultCampaignName("Vivo India", "Vivo V80"), "Vivo India — Vivo V80");
  });
});

describe("emptyBusinessProfile", () => {
  it("stamps the brand's own name, never the demo", () => {
    const p = emptyBusinessProfile("Vivo India");
    assert.equal(p.businessName, "Vivo India");
    assert.notEqual(p.businessName, "Aura Atelier");
  });

  it("is a complete, empty profile that is not yet ready", () => {
    const p = emptyBusinessProfile("Vivo India");
    assert.deepEqual(p.products, []);
    assert.deepEqual(p.targetAudience, []);
    assert.equal(p.summary, "");
    // A name alone is not a set-up brand.
    assert.equal(brandProfileReady(p), false);
  });

  it("is ready once it has a summary", () => {
    assert.equal(brandProfileReady({ ...emptyBusinessProfile("Vivo India"), summary: "A real summary" }), true);
  });
});

describe("campaignBudgetStatus", () => {
  const cmp = campaign({ id: "c1", budget: 100000 });
  function creatorWith(handle: string, packagePrice: number): CreatorProfile {
    return { handle, pricing: { currency: "USD", packagePrice } } as unknown as CreatorProfile;
  }
  function app(handle: string, status: Application["status"], quotedPrice = 0): Application {
    return { id: handle, campaignId: "c1", campaignName: "x", creatorHandle: handle, pitch: "", quotedPrice, openToBarter: false, status, appliedAt: "" };
  }

  it("subtracts an accepted creator's rate from the budget", () => {
    // Mamitha at $25k accepts → $75k remains for others.
    const status = campaignBudgetStatus(cmp, [app("@mamitha", "approved")], [creatorWith("@mamitha", 25000)]);
    assert.equal(status.budget, 100000);
    assert.equal(status.committed, 25000);
    assert.equal(status.remaining, 75000);
    assert.equal(status.count, 1);
    assert.equal(status.overBudget, false);
  });

  it("only counts accepted creators, not pending invites or applicants", () => {
    const apps = [app("@a", "approved"), app("@b", "invited"), app("@c", "applied"), app("@d", "rejected")];
    const creators = [creatorWith("@a", 20000), creatorWith("@b", 30000), creatorWith("@c", 40000), creatorWith("@d", 50000)];
    const status = campaignBudgetStatus(cmp, apps, creators);
    assert.equal(status.committed, 20000);
    assert.equal(status.remaining, 80000);
  });

  it("uses the quoted price when a creator applied with one, else the package rate", () => {
    const apps = [app("@quoted", "approved", 12000), app("@package", "approved", 0)];
    const creators = [creatorWith("@quoted", 99999), creatorWith("@package", 8000)];
    const status = campaignBudgetStatus(cmp, apps, creators);
    assert.equal(status.committed, 12000 + 8000);
  });

  it("flags going over budget without a negative remaining", () => {
    const apps = [app("@big", "approved")];
    const status = campaignBudgetStatus(cmp, apps, [creatorWith("@big", 130000)]);
    assert.equal(status.remaining, 0);
    assert.equal(status.overBudget, true);
  });
});

describe("creatorRate", () => {
  it("prefers a quoted price, then the package rate, then zero", () => {
    assert.equal(creatorRate({ pricing: { packagePrice: 8000 } } as unknown as CreatorProfile, 5000), 5000);
    assert.equal(creatorRate({ pricing: { packagePrice: 8000 } } as unknown as CreatorProfile), 8000);
    assert.equal(creatorRate(undefined), 0);
  });
});

describe("buildProductPersonaText", () => {
  it("uses the typed product name, not the Hero placeholder", () => {
    const text = buildProductPersonaText(["Vivo V80", "Tech buyers", "Better cameras", "Camera, battery", "Reviews"], campaign(), profile);
    assert.ok(text.startsWith("Vivo V80 is positioned for Tech buyers"));
    assert.ok(!text.includes("Hero product"));
  });

  it("falls back to profile fields when answers are blank", () => {
    const text = buildProductPersonaText([], campaign({ product: "Flagship X" }), profile);
    assert.ok(text.startsWith("Flagship X is positioned for High-intent buyers"));
    assert.ok(text.includes("Camera quality"));
  });
});
