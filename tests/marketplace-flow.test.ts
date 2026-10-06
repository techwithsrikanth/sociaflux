import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

import { closeDb, getDb } from "../src/lib/db/client";
import {
  getBrand,
  getCreator,
  inviteApplication,
  listApplications,
  listCampaigns,
  saveApplication,
  saveBrand,
  saveCampaign,
  saveCreator,
  setApplicationStatus
} from "../src/lib/db/repositories";
import { campaignsForBrand } from "../src/lib/brand-flow";
import { normaliseCampaign, slug } from "../src/lib/marketplace";
import type { Application } from "../src/lib/marketplace";
import type { BusinessProfile, CreatorProfile } from "../src/lib/types";

const workdir = mkdtempSync(join(tmpdir(), "sociaflux-flow-"));
process.env.SOCIAFLUX_TURSO_DATABASE_URL = `file:${join(workdir, "test.db").replace(/\\/g, "/")}`;
delete process.env.SOCIAFLUX_TURSO_AUTH_TOKEN;

function brand(name: string): BusinessProfile {
  return { businessName: name, website: `https://${slug(name)}.com`, products: ["Flagship"], targetAudience: ["Buyers"], uniqueSellingPoints: ["Quality"], primaryValueProposition: "Value", summary: `${name} summary` } as unknown as BusinessProfile;
}

function creator(handle: string): CreatorProfile {
  return {
    name: handle.replace("@", ""), handle, bio: "", primaryNiche: "Smartphones & gadgets",
    subNiches: [], contentLanguages: ["English"], secondaryNiches: [], topicsDiscussed: [],
    contentPillars: [], contentStyles: [], brandPersonality: [], publicFollowerCount: 500000,
    estimatedAudience: { ageGroups: [], interests: [], geography: [], languages: [] },
    contentQuality: { imageQuality: "", videoQuality: "", editingQuality: "", brandingConsistency: "", postingConsistency: "" },
    postingBehaviour: { approximateFrequency: "", dominantFormat: "", captionStyle: "", hashtagUsage: "" },
    brandSafety: { profanityRisk: "", politicalContent: "", sensitiveTopics: "", adultContentIndicators: "", overallScore: 90 },
    previousCollaborations: { detectedSponsoredContent: [], mentionedBrands: [], productCategories: [] },
    pricing: { currency: "USD", packagePrice: 2000 }, summary: "", embeddingText: "", rawData: {}
  };
}

function application(id: string, campaignId: string, handle: string, overrides: Partial<Application> = {}): Application {
  return { id, campaignId, campaignName: "c", creatorHandle: handle, pitch: "pitch", quotedPrice: 1500, openToBarter: false, status: "applied", appliedAt: new Date().toISOString(), ...overrides };
}

before(async () => {
  const sql = readFileSync(join(process.cwd(), "src/lib/db/schema.sql"), "utf8");
  const statements = sql.split(";").map((s) => s.trim()).filter((s) => s && !s.split("\n").every((line) => line.trim().startsWith("--")));
  for (const statement of statements) await getDb().execute(statement);
});

after(() => {
  closeDb();
  try { rmSync(workdir, { recursive: true, force: true }); } catch { /* disposable */ }
});

describe("brand and creator marketplace flow", () => {
  it("scopes each brand's campaigns to that brand", async () => {
    await saveBrand(brand("Vivo India"), slug("Vivo India"));
    await saveBrand(brand("Samsung India"), slug("Samsung India"));
    await saveCampaign(normaliseCampaign({ id: "cmp_vivo", name: "Vivo India — Vivo V80", brandName: "Vivo India", budget: 5000 }), slug("Vivo India"));
    await saveCampaign(normaliseCampaign({ id: "cmp_sam", name: "Samsung India — Galaxy", brandName: "Samsung India", budget: 5000 }), slug("Samsung India"));

    const all = await listCampaigns();
    // The job board sees both; the brand dashboard must not.
    assert.ok(all.length >= 2);
    assert.deepEqual(campaignsForBrand(all, "Vivo India").map((c) => c.id), ["cmp_vivo"]);
    assert.deepEqual(campaignsForBrand(all, "Samsung India").map((c) => c.id), ["cmp_sam"]);
  });

  it("shows a creator's application only under the campaign they applied to", async () => {
    await saveCreator(creator("@mamitha_baiju"));
    await saveApplication(application("app_1", "cmp_sam", "@mamitha_baiju"));

    // Samsung's campaign has the applicant; Vivo's brand-new campaign has none.
    assert.equal((await listApplications({ campaignId: "cmp_sam" })).length, 1);
    assert.equal((await listApplications({ campaignId: "cmp_vivo" })).length, 0);
  });

  it("does not approve anyone until the brand decides", async () => {
    const applied = await listApplications({ campaignId: "cmp_sam" });
    // Freshly applied, never auto-approved.
    assert.equal(applied[0].status, "applied");

    const approved = await setApplicationStatus("app_1", "approved");
    assert.equal(approved?.status, "approved");
    assert.equal((await listApplications({ campaignId: "cmp_sam" }))[0].status, "approved");
  });

  it("keeps one application per creator per campaign", async () => {
    // Re-applying updates the same row rather than creating a duplicate.
    await saveApplication(application("app_dupe", "cmp_sam", "@mamitha_baiju", { quotedPrice: 1800 }));
    const rows = await listApplications({ campaignId: "cmp_sam" });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].quotedPrice, 1800);
  });

  it("lists a creator's own applications across campaigns", async () => {
    await saveApplication(application("app_2", "cmp_vivo", "@mamitha_baiju"));
    const mine = await listApplications({ creatorHandle: "@mamitha_baiju" });
    assert.equal(mine.length, 2);
  });

  it("persists and reloads a brand profile by slug", async () => {
    // The brand profile must survive reloads rather than reverting to a demo.
    await saveBrand(brand("Vivo India"), slug("Vivo India"));
    const loaded = await getBrand(slug("Vivo India"));
    assert.equal(loaded?.businessName, "Vivo India");
  });
});

describe("brand reaching out to a creator (invitation lifecycle)", () => {
  it("creates an invitation the creator must act on, not an auto-approval", async () => {
    await saveCreator(creator("@newcreator"));
    const { application: invited, created } = await inviteApplication({
      id: "app_invite", campaignId: "cmp_vivo", campaignName: "Vivo India — Vivo V80", creatorHandle: "@newcreator"
    });
    assert.equal(created, true);
    // Pending the creator's decision — the brand cannot see contact yet.
    assert.equal(invited.status, "invited");
    assert.ok((await listApplications({ creatorHandle: "@newcreator" })).some((a) => a.status === "invited"));
  });

  it("carries the creator's rate, so accepting means accepting at that price", async () => {
    await saveCreator(creator("@ratecreator"));
    const { application } = await inviteApplication({
      id: "app_rate", campaignId: "cmp_vivo", campaignName: "x", creatorHandle: "@ratecreator", quotedPrice: 25000
    });
    assert.equal(application.quotedPrice, 25000);
    const accepted = await setApplicationStatus(application.id, "approved");
    // The agreed price survives the accept, so the brand sees $25,000.
    assert.equal(accepted?.quotedPrice, 25000);
  });

  it("lets the creator accept, which moves it to approved for the brand", async () => {
    const accepted = await setApplicationStatus("app_invite", "approved");
    assert.equal(accepted?.status, "approved");
  });

  it("lets the creator reject an invitation", async () => {
    await saveCreator(creator("@rejector"));
    const { application } = await inviteApplication({ id: "app_reject", campaignId: "cmp_vivo", campaignName: "x", creatorHandle: "@rejector" });
    const rejected = await setApplicationStatus(application.id, "rejected");
    assert.equal(rejected?.status, "rejected");
  });

  it("never overwrites an application the creator already made", async () => {
    // mamitha already applied (and was approved) on cmp_sam earlier.
    await setApplicationStatus("app_1", "approved");
    const { created, application: existing } = await inviteApplication({
      id: "app_invite_2", campaignId: "cmp_sam", campaignName: "x", creatorHandle: "@mamitha_baiju"
    });
    assert.equal(created, false);
    // The approval stands — reaching out did not downgrade it.
    assert.equal(existing.status, "approved");
  });
});

describe("creator data survives a round-trip (no Unknown after relogin)", () => {
  it("saves and reloads a creator with its real metrics", async () => {
    const withMetrics = creator("@persisttest");
    withMetrics.publicFollowerCount = 6_883_029;
    withMetrics.publicPostCount = 247;
    await saveCreator(withMetrics);

    // This is exactly what login does: fetch the profile from the DB by handle.
    const reloaded = await getCreator("@persisttest");
    assert.equal(reloaded?.handle, "@persisttest");
    assert.equal(reloaded?.publicFollowerCount, 6_883_029);
    assert.equal(reloaded?.publicPostCount, 247);
  });
});
