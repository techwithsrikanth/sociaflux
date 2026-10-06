import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildProductPersonaText, campaignsForBrand, defaultCampaignName, resolveCampaignProduct } from "../src/lib/brand-flow";
import { normaliseCampaign } from "../src/lib/marketplace";
import type { Campaign } from "../src/lib/marketplace";
import type { BusinessProfile } from "../src/lib/types";

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
