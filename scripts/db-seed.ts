/**
 * Seeds the demo creators, a starter campaign and its applications.
 *
 * Idempotent: every write is an upsert keyed on handle, campaign id, or
 * (campaign, creator), so re-running refreshes rather than duplicates.
 */

import { demoApplications, demoBusinessProfile, demoCreatorProfiles } from "../src/lib/demo-data";
import { normaliseCampaign, slug } from "../src/lib/marketplace";
import { saveApplication, saveBrand, saveCampaign, saveCreator } from "../src/lib/db/repositories";
import { databaseUrl, isRemoteDatabase } from "../src/lib/db/client";

async function main() {
  const brandId = slug(demoBusinessProfile.businessName);
  await saveBrand(demoBusinessProfile, brandId);

  for (const creator of demoCreatorProfiles) {
    await saveCreator(creator);
  }

  // The campaign the seeded applications point at.
  const campaign = normaliseCampaign({
    id: "cmp_aura-atelier-awareness",
    name: `${demoBusinessProfile.businessName} awareness`,
    brandName: demoBusinessProfile.businessName,
    product: demoBusinessProfile.products[0] || "Barrier Reset Serum",
    goal: "Find aligned creators",
    audience: demoBusinessProfile.targetAudience.slice(0, 2).join(", "),
    creatorType: demoBusinessProfile.brandTone.join(", "),
    budget: 6000,
    duration: "21 days",
    objective: "awareness",
    targets: { reach: 240_000, engagementRate: 3.5, cpmTarget: 25 },
    deliverables: ["1 reel", "Story set"],
    targetNiches: ["Skincare", "Clean beauty"],
    barterPolicy: "flexible",
    contentGuidelines: "Show the serum inside a real routine rather than a scripted review. Lead with the sensitive-skin problem it solves and keep the tone calm and expert.",
    creatorRequirements: "Creators who already talk about skincare and can film in natural light.",
    mustInclude: ["Fragrance-free", "Dermatologist tested"],
    mustAvoid: ["Medical claims", "Competitor comparisons"],
    hashtags: ["#ad"],
    usageRights: "Organic only, 3 months",
    briefAssets: [
      { id: "asset_seed_site", kind: "link", url: demoBusinessProfile.website, title: "Brand website", note: "Product details and claims you can safely repeat." }
    ]
  });
  await saveCampaign(campaign, brandId);

  for (const application of demoApplications) {
    await saveApplication({ ...application, campaignId: campaign.id, campaignName: campaign.name });
  }

  console.log(`Seeded ${isRemoteDatabase() ? "Turso" : databaseUrl()}`);
  console.log(`  brand: ${demoBusinessProfile.businessName}`);
  console.log(`  creators: ${demoCreatorProfiles.map((creator) => creator.handle).join(", ")}`);
  console.log(`  campaign: ${campaign.name} (${campaign.id})`);
  console.log(`  applications: ${demoApplications.length}`);
}

main().catch((error) => {
  console.error("Seed failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
