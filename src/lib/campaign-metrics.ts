/**
 * Campaign planning estimates.
 *
 * Turns a roster of creators into projected reach, engagement, clicks,
 * conversions and spend, and compares that against the targets a brand set when
 * posting the campaign.
 *
 * Every rate below is a planning heuristic, not measured data. They encode the
 * usual shape of Instagram delivery — reach rate falls as follower count rises,
 * engagement rate falls with it, and repeat posts reach a shrinking slice of new
 * people. Swap them for real platform numbers once the API is wired up.
 */

import { creatorAskingPrice } from "./marketplace";
import type { Campaign, CampaignObjective, CampaignTargets } from "./marketplace";
import type { CreatorProfile } from "./types";

type Tier = { maxFollowers: number; reachRate: number; engagementRate: number };

/** Share of followers a single post reaches, and engagements per person reached. */
const TIERS: Tier[] = [
  { maxFollowers: 10_000, reachRate: 0.35, engagementRate: 0.08 },
  { maxFollowers: 50_000, reachRate: 0.28, engagementRate: 0.06 },
  { maxFollowers: 100_000, reachRate: 0.22, engagementRate: 0.045 },
  { maxFollowers: 500_000, reachRate: 0.16, engagementRate: 0.03 },
  { maxFollowers: 1_000_000, reachRate: 0.12, engagementRate: 0.025 },
  { maxFollowers: Number.POSITIVE_INFINITY, reachRate: 0.09, engagementRate: 0.02 }
];

/** Each extra deliverable adds this share of the first post's reach as new people. */
const REPEAT_REACH_FACTOR = 0.35;

/** Unique reach cannot run away past the creator's own audience by more than this. */
const MAX_REACH_MULTIPLE_OF_FOLLOWERS = 1.5;

/** Share of reached people who tap through, and of those who convert, by objective. */
const OBJECTIVE_RATES: Record<CampaignObjective, { clickRate: number; conversionRate: number }> = {
  awareness: { clickRate: 0.006, conversionRate: 0.015 },
  engagement: { clickRate: 0.008, conversionRate: 0.015 },
  traffic: { clickRate: 0.02, conversionRate: 0.02 },
  conversions: { clickRate: 0.018, conversionRate: 0.045 },
  ugc: { clickRate: 0.004, conversionRate: 0.01 }
};

export const OBJECTIVE_LABEL: Record<CampaignObjective, string> = {
  awareness: "Awareness",
  engagement: "Engagement",
  traffic: "Traffic",
  conversions: "Conversions",
  ugc: "UGC / content"
};

export type CreatorProjection = {
  handle: string;
  followers: number;
  /** Distinct people expected to see the campaign. */
  reach: number;
  /** Total views, counting repeat exposure. */
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  /** What this creator costs, from their quote or published rate. */
  cost: number;
  /** Cost per 1,000 people reached. */
  cpm: number;
};

export type CampaignProjection = {
  creators: CreatorProjection[];
  reach: number;
  impressions: number;
  engagements: number;
  clicks: number;
  conversions: number;
  cost: number;
  cpm: number;
  /** Cost per conversion; 0 when nothing is projected to convert. */
  cpa: number;
  engagementRate: number;
  budget: number;
  budgetRemaining: number;
  overBudget: boolean;
};

export type TargetProgress = {
  metric: string;
  label: string;
  target: number;
  projected: number;
  /** 0..1+, where 1 means the target is met. */
  ratio: number;
  met: boolean;
  /** True when a lower number is better, as with CPM and CPA. */
  lowerIsBetter: boolean;
  format: "number" | "currency" | "percent";
};

function tierFor(followers: number) {
  return TIERS.find((tier) => followers <= tier.maxFollowers) || TIERS[TIERS.length - 1];
}

function deliverableCount(campaign: Campaign) {
  return Math.max(1, campaign.deliverables?.length || 1);
}

/** Projects one creator's delivery for a campaign. */
export function projectCreator(creator: CreatorProfile, campaign: Campaign, quotedPrice?: number): CreatorProjection {
  const followers = creator.publicFollowerCount || 0;
  const tier = tierFor(followers);
  const posts = deliverableCount(campaign);
  const objective = campaign.objective || "awareness";
  const rates = OBJECTIVE_RATES[objective];

  const perPostReach = followers * tier.reachRate;
  const impressions = Math.round(perPostReach * posts);
  const rawReach = perPostReach * (1 + REPEAT_REACH_FACTOR * (posts - 1));
  const reach = Math.round(Math.min(rawReach, followers * MAX_REACH_MULTIPLE_OF_FOLLOWERS));

  const engagements = Math.round(reach * tier.engagementRate);
  const clicks = Math.round(reach * rates.clickRate);
  const conversions = Math.round(clicks * rates.conversionRate * 10) / 10;
  const cost = quotedPrice ?? creatorAskingPrice(creator);

  return {
    handle: creator.handle,
    followers,
    reach,
    impressions,
    engagements,
    clicks,
    conversions,
    cost,
    cpm: reach > 0 ? Math.round((cost / reach) * 1000 * 100) / 100 : 0
  };
}

/** Projects the whole roster a brand has selected for a campaign. */
export function projectCampaign(
  campaign: Campaign,
  roster: Array<{ creator: CreatorProfile; quotedPrice?: number }>
): CampaignProjection {
  const creators = roster.map((entry) => projectCreator(entry.creator, campaign, entry.quotedPrice));

  const sum = (pick: (projection: CreatorProjection) => number) =>
    creators.reduce((total, projection) => total + pick(projection), 0);

  const reach = sum((item) => item.reach);
  const cost = sum((item) => item.cost);
  const conversions = Math.round(sum((item) => item.conversions) * 10) / 10;
  const engagements = sum((item) => item.engagements);
  const budget = campaign.budget || 0;

  return {
    creators,
    reach,
    impressions: sum((item) => item.impressions),
    engagements,
    clicks: sum((item) => item.clicks),
    conversions,
    cost,
    cpm: reach > 0 ? Math.round((cost / reach) * 1000 * 100) / 100 : 0,
    cpa: conversions > 0 ? Math.round((cost / conversions) * 100) / 100 : 0,
    engagementRate: reach > 0 ? Math.round((engagements / reach) * 1000) / 10 : 0,
    budget,
    budgetRemaining: budget - cost,
    overBudget: cost > budget
  };
}

/** Compares a projection against the campaign's stated targets. */
export function trackTargets(targets: CampaignTargets | undefined, projection: CampaignProjection): TargetProgress[] {
  const progress: TargetProgress[] = [];
  if (!targets) return progress;

  const higherIsBetter = (metric: string, label: string, target?: number, projected = 0, format: TargetProgress["format"] = "number") => {
    if (!target) return;
    progress.push({
      metric,
      label,
      target,
      projected,
      ratio: target > 0 ? projected / target : 0,
      met: projected >= target,
      lowerIsBetter: false,
      format
    });
  };

  const lowerIsBetter = (metric: string, label: string, target?: number, projected = 0) => {
    if (!target) return;
    // Nothing projected yet is not a win, so an empty roster never counts as met.
    const met = projected > 0 && projected <= target;
    progress.push({
      metric,
      label,
      target,
      projected,
      ratio: projected > 0 ? target / projected : 0,
      met,
      lowerIsBetter: true,
      format: "currency"
    });
  };

  higherIsBetter("reach", "Reach", targets.reach, projection.reach);
  higherIsBetter("impressions", "Impressions", targets.impressions, projection.impressions);
  higherIsBetter("engagementRate", "Engagement rate", targets.engagementRate, projection.engagementRate, "percent");
  higherIsBetter("clicks", "Clicks", targets.clicks, projection.clicks);
  higherIsBetter("conversions", "Conversions", targets.conversions, projection.conversions);
  lowerIsBetter("cpmTarget", "CPM", targets.cpmTarget, projection.cpm);
  lowerIsBetter("cpaTarget", "Cost per conversion", targets.cpaTarget, projection.cpa);

  return progress;
}

/**
 * Greedy roster suggestion: the cheapest reach first, until the reach target or
 * the budget runs out. Used to pre-fill a shortlist, never to auto-approve.
 */
export function suggestRoster(
  campaign: Campaign,
  candidates: Array<{ creator: CreatorProfile; quotedPrice?: number }>
): Array<{ creator: CreatorProfile; quotedPrice?: number }> {
  const targetReach = campaign.targets?.reach || 0;
  const budget = campaign.budget || 0;

  const ranked = [...candidates]
    .map((entry) => ({ entry, projection: projectCreator(entry.creator, campaign, entry.quotedPrice) }))
    .filter((item) => item.projection.reach > 0)
    .sort((left, right) => {
      const leftCpm = left.projection.cpm || Number.POSITIVE_INFINITY;
      const rightCpm = right.projection.cpm || Number.POSITIVE_INFINITY;
      return leftCpm - rightCpm;
    });

  const chosen: Array<{ creator: CreatorProfile; quotedPrice?: number }> = [];
  let spend = 0;
  let reach = 0;

  for (const item of ranked) {
    if (budget && spend + item.projection.cost > budget) continue;
    chosen.push(item.entry);
    spend += item.projection.cost;
    reach += item.projection.reach;
    if (targetReach && reach >= targetReach) break;
  }

  return chosen;
}
