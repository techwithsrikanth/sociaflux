/**
 * Brand-side campaign helpers, kept here rather than inline in ProductShell so
 * they can be unit tested without a browser.
 *
 * The important one is `campaignsForBrand`. The marketplace stores every
 * brand's campaigns in one table, and the creator job board is meant to show
 * all of them — but the brand's own Applicants view must show only its own, or
 * one brand sees another brand's applicants and approvals. That cross-brand
 * leak is what made a freshly posted campaign look like it had auto-approved a
 * creator: it was a different brand's campaign, shown because nothing scoped
 * the list.
 */

import type { Application, Campaign } from "./marketplace";
import type { BusinessProfile, CreatorProfile } from "./types";

const DEFAULT_CAMPAIGN_NAME = "Launch campaign";
const DEFAULT_PRODUCT_NAME = "Hero product";

/** Case- and spacing-insensitive brand key. Empty for a blank name. */
function brandKey(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Campaigns owned by this brand. Matched on a normalised name so "Vivo India"
 * and "vivo india" are the same brand. A campaign with no brand recorded is
 * treated as owned, so legacy rows written before brand stamping still appear.
 * A blank brand name returns everything rather than hiding all campaigns.
 */
export function campaignsForBrand(campaigns: Campaign[], brandName: string): Campaign[] {
  const target = brandKey(brandName);
  if (!target) return campaigns;
  return campaigns.filter((campaign) => {
    const owner = brandKey(campaign.brandName || "");
    return !owner || owner === target;
  });
}

/**
 * The product name a campaign should use. The brand types it into "What product
 * are you launching?" (answers[0]); fall back to the campaign's own product, a
 * chosen product persona, then a generic label — but never leave the "Hero
 * product" placeholder showing once the brand has typed a real name.
 */
export function resolveCampaignProduct(answers: string[], campaign: Campaign, personaName?: string): string {
  const typed = (answers[0] || "").trim();
  if (typed) return typed;
  if (personaName && personaName.trim()) return personaName.trim();
  if (campaign.product && campaign.product !== DEFAULT_PRODUCT_NAME) return campaign.product;
  return campaign.product || DEFAULT_PRODUCT_NAME;
}

/**
 * A distinct campaign name. Left at the default, every campaign reads "Launch
 * campaign" and the brand cannot tell them apart in the Applicants dropdown, so
 * an untouched default becomes "<brand> — <product>".
 */
export function defaultCampaignName(brandName: string, product: string, currentName?: string): string {
  const current = (currentName || "").trim();
  if (current && current !== DEFAULT_CAMPAIGN_NAME) return current;
  const brand = (brandName || "").trim();
  const name = (product || "").trim() || "Launch";
  return brand ? `${brand} — ${name}` : `${name} campaign`;
}

/**
 * A blank brand profile stamped with the account's name, used when a brand
 * signs in and has nothing saved yet. Critically this is NOT the Aura Atelier
 * demo: a new brand must see its own name, not someone else's, everywhere the
 * workspace reads businessName.
 */
export function emptyBusinessProfile(name: string): BusinessProfile {
  return {
    businessName: name,
    website: "",
    description: "",
    industry: "",
    category: "",
    products: [],
    services: [],
    targetAudience: [],
    brandTone: [],
    pricePositioning: "",
    country: "",
    languages: [],
    socialLinks: [],
    visualStyle: [],
    keywords: [],
    primaryValueProposition: "",
    uniqueSellingPoints: [],
    brandPersonality: [],
    estimatedCustomerPersona: [],
    importantPages: [],
    contactInformation: [],
    frequentlyMentionedTerms: [],
    summary: "",
    embeddingText: "",
    rawData: {}
  };
}

/** True once a brand has actually set up its persona, not just its name. */
export function brandProfileReady(profile: BusinessProfile): boolean {
  return Boolean(profile.businessName && profile.summary);
}

export type CampaignBudgetStatus = {
  budget: number;
  /** Sum of the rates of creators who have accepted (approved) for this campaign. */
  committed: number;
  /** Budget left to reach out to more creators. Never negative. */
  remaining: number;
  /** How many creators are committed. */
  count: number;
  /** True once commitments meet or exceed the budget. */
  overBudget: boolean;
};

/**
 * What a campaign's budget has left once accepted creators are paid.
 *
 * A creator's rate is the price they quoted when they applied, or — for a
 * creator the brand reached out to, whose invitation carries no price — their
 * package rate from their profile. Only accepted (approved) creators count,
 * because an invitation still pending the creator's answer is not a commitment.
 */
export function campaignBudgetStatus(campaign: Campaign, applications: Application[], creators: CreatorProfile[]): CampaignBudgetStatus {
  const approved = applications.filter((application) => application.campaignId === campaign.id && application.status === "approved");
  const committed = approved.reduce((sum, application) => {
    const creator = creators.find((candidate) => candidate.handle === application.creatorHandle);
    const rate = application.quotedPrice || creator?.pricing?.packagePrice || 0;
    return sum + Math.max(0, rate);
  }, 0);
  const budget = Math.max(0, campaign.budget || 0);
  return {
    budget,
    committed,
    remaining: Math.max(0, budget - committed),
    count: approved.length,
    overBudget: committed > budget
  };
}

/** The rate a single creator would consume against a budget. */
export function creatorRate(creator: CreatorProfile | undefined, quotedPrice = 0): number {
  return Math.max(0, quotedPrice || creator?.pricing?.packagePrice || 0);
}

/** The campaign-persona paragraph shown under the composer and saved on launch. */
export function buildProductPersonaText(answers: string[], campaign: Campaign, profile: BusinessProfile): string {
  const product = resolveCampaignProduct(answers, campaign);
  const audience = answers[1] || campaign.audience || profile.targetAudience.join(", ");
  const problem = answers[2] || campaign.goal;
  const proof = answers[3] || profile.uniqueSellingPoints.join("; ") || profile.primaryValueProposition;
  const format = answers[4] || campaign.creatorType;
  return `${product} is positioned for ${audience}. It should be presented as solving: ${problem}. Creators should emphasize ${proof}. Best creator format: ${format}.`;
}
