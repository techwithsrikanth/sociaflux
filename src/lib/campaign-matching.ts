/**
 * Campaign <-> creator matching engine.
 *
 * Scores each creator against a campaign on three weighted criteria — tag
 * overlap, region fit and barter compatibility — and separately reports hard
 * eligibility, so callers can rank everyone while still flagging who the
 * campaign's own rules exclude.
 */

import { campaignTags, compactNumber, creatorNiches, isOpenForBarter } from "./marketplace";
import { bestRegionMatch, isSatisfiedLevel, regionLabel } from "./regions";
import type { BarterPolicy, Campaign } from "./marketplace";
import type { Region, RegionMatchLevel } from "./regions";
import type { CreatorProfile } from "./types";

export const MATCH_WEIGHTS = { tag: 0.5, region: 0.3, barter: 0.2 } as const;

/** Extra credit when a campaign tag hits the creator's headline niche. */
const PRIMARY_NICHE_BONUS = 0.15;

/** Region scores by how well the campaign's target list was satisfied. */
const REGION_SCORES: Record<RegionMatchLevel, number> = {
  open: 1,
  city: 1,
  state: 1,
  country: 1,
  /** Right country, wrong state/city. */
  partial: 0.5,
  /** Creator never stated a location. */
  unknown: 0.5,
  none: 0
};

export type MatchBreakdown = {
  /** 0..1 share of campaign tags the creator covers. */
  tagScore: number;
  /** 0..1 region fit. */
  regionScore: number;
  /** 0..1 barter compatibility. */
  barterScore: number;
  matchedTags: string[];
  primaryNicheMatched: boolean;
  regionLevel: RegionMatchLevel;
  matchedRegion?: Region;
};

export type CampaignMatch = {
  creatorHandle: string;
  /** Weighted 0..100 score. */
  score: number;
  /** False when a hard campaign rule rules this creator out. */
  eligible: boolean;
  /** Why the creator is ineligible, if they are. */
  exclusionReasons: string[];
  /** Human-readable positives behind the score. */
  reasons: string[];
  breakdown: MatchBreakdown;
};

export type MatchOptions = {
  /**
   * Treat target regions as a hard filter regardless of the campaign's own
   * `regionRequirement`. Used by brand-side filtering UI.
   */
  requireRegionMatch?: boolean;
};

function normaliseTag(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Everything a creator can be matched on: declared niches plus content signals. */
export function creatorTags(creator: CreatorProfile) {
  return [
    ...creatorNiches(creator),
    ...creator.topicsDiscussed,
    ...creator.contentPillars,
    ...creator.contentStyles
  ].filter(Boolean);
}

/**
 * Campaign tags the creator covers. A tag counts when it equals, contains, or
 * is contained by one of the creator's tags, so "Skincare" matches a creator
 * tagged "Skincare education".
 */
export function intersectTags(campaignTagList: string[], creatorTagList: string[]) {
  const creatorNormalised = creatorTagList.map(normaliseTag).filter(Boolean);
  const matched: string[] = [];

  for (const tag of campaignTagList) {
    const needle = normaliseTag(tag);
    if (!needle) continue;
    const hit = creatorNormalised.some((owned) => owned === needle || owned.includes(needle) || needle.includes(owned));
    if (hit && !matched.includes(tag)) matched.push(tag);
  }
  return matched;
}

/**
 * Fallback affinity for untagged campaigns: word overlap between the brief and
 * the creator's content signals, normalised to 0..1.
 */
export function briefAffinity(campaign: Campaign, creator: CreatorProfile) {
  const brief = [campaign.product, campaign.goal, campaign.audience, campaign.creatorType]
    .join(" ")
    .toLowerCase();
  const words = Array.from(new Set(brief.split(/[^a-z0-9]+/).filter((word) => word.length > 3)));
  if (!words.length) return 0.5;

  const haystack = [...creatorTags(creator), ...creator.estimatedAudience.interests].join(" ").toLowerCase();
  const overlap = words.filter((word) => haystack.includes(word)).length;
  return Math.min(1, overlap / Math.min(words.length, 6));
}

export function scoreTags(campaign: Campaign, creator: CreatorProfile) {
  const tags = campaignTags(campaign);
  if (!tags.length) {
    return { tagScore: briefAffinity(campaign, creator), matchedTags: [] as string[], primaryNicheMatched: false };
  }

  const matchedTags = intersectTags(tags, creatorTags(creator));
  const primaryNicheMatched = creator.primaryNiche
    ? intersectTags(tags, [creator.primaryNiche]).length > 0
    : false;

  const coverage = matchedTags.length / tags.length;
  const tagScore = Math.min(1, coverage + (primaryNicheMatched ? PRIMARY_NICHE_BONUS : 0));
  return { tagScore, matchedTags, primaryNicheMatched };
}

export function scoreRegion(campaign: Campaign, creator: CreatorProfile) {
  const targets = campaign.targetRegions || [];
  const { level, region } = bestRegionMatch(targets, creator.location);
  return { regionScore: REGION_SCORES[level], regionLevel: level, matchedRegion: region };
}

export function scoreBarter(policy: BarterPolicy, creator: CreatorProfile) {
  const openForBarter = isOpenForBarter(creator);
  if (policy === "barter_only") return openForBarter ? 1 : 0;
  if (policy === "flexible") return openForBarter ? 1 : 0.5;
  // Paid campaigns do not care either way, so barter stays neutral-full.
  return 1;
}

export function matchCreatorToCampaign(
  creator: CreatorProfile,
  campaign: Campaign,
  options: MatchOptions = {}
): CampaignMatch {
  const policy: BarterPolicy = campaign.barterPolicy || "paid";
  const { tagScore, matchedTags, primaryNicheMatched } = scoreTags(campaign, creator);
  const { regionScore, regionLevel, matchedRegion } = scoreRegion(campaign, creator);
  const barterScore = scoreBarter(policy, creator);

  const score = Math.round(
    100 * (MATCH_WEIGHTS.tag * tagScore + MATCH_WEIGHTS.region * regionScore + MATCH_WEIGHTS.barter * barterScore)
  );

  const exclusionReasons: string[] = [];
  const reasons: string[] = [];

  if (campaign.minFollowers && (creator.publicFollowerCount || 0) < campaign.minFollowers) {
    exclusionReasons.push(`Needs ${compactNumber(campaign.minFollowers)}+ followers`);
  }
  if (policy === "barter_only" && !isOpenForBarter(creator)) {
    exclusionReasons.push("Campaign is barter only and this creator is not open to barter");
  }

  const regionRequired = options.requireRegionMatch || campaign.regionRequirement === "required";
  if (regionRequired && !isSatisfiedLevel(regionLevel)) {
    const targets = campaign.targetRegions || [];
    exclusionReasons.push(
      regionLevel === "unknown"
        ? "Creator has not set a location"
        : `Outside the target regions (${targets.map(regionLabel).slice(0, 3).join("; ")})`
    );
  }

  if (matchedTags.length) {
    reasons.push(`Tag overlap on ${matchedTags.slice(0, 4).join(", ")}.`);
  }
  if (primaryNicheMatched) {
    reasons.push(`${creator.primaryNiche} is their primary niche.`);
  }
  if (isSatisfiedLevel(regionLevel) && matchedRegion) {
    reasons.push(`Based in a target region (${regionLabel(matchedRegion)}).`);
  }
  if (regionLevel === "open") {
    reasons.push("Campaign is open to every region.");
  }
  if (policy !== "paid" && isOpenForBarter(creator)) {
    reasons.push("Open to barter collaborations, which this campaign offers.");
  }
  if (!reasons.length) {
    reasons.push("Some broad positioning overlap was detected.");
  }

  return {
    creatorHandle: creator.handle,
    score,
    eligible: exclusionReasons.length === 0,
    exclusionReasons,
    reasons,
    breakdown: { tagScore, regionScore, barterScore, matchedTags, primaryNicheMatched, regionLevel, matchedRegion }
  };
}

/** Ranks creators for a campaign: eligible first, then by score. */
export function rankCreatorsForCampaign(
  creators: CreatorProfile[],
  campaign: Campaign,
  options: MatchOptions = {}
): CampaignMatch[] {
  return creators
    .map((creator) => matchCreatorToCampaign(creator, campaign, options))
    .sort((left, right) => {
      if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
      return right.score - left.score;
    });
}

/** Same engine from the creator side: ranks open campaigns for one creator. */
export function rankCampaignsForCreator(
  campaigns: Campaign[],
  creator: CreatorProfile,
  options: MatchOptions = {}
): Array<{ campaign: Campaign; match: CampaignMatch }> {
  return campaigns
    .map((campaign) => ({ campaign, match: matchCreatorToCampaign(creator, campaign, options) }))
    .sort((left, right) => right.match.score - left.match.score);
}

/**
 * Hard eligibility only, for UI that needs to flag an under-qualified creator
 * without showing a score.
 */
export function eligibleForCampaign(creator: CreatorProfile, campaign: Campaign, options: MatchOptions = {}) {
  const { eligible, exclusionReasons } = matchCreatorToCampaign(creator, campaign, options);
  return { eligible, reasons: exclusionReasons };
}

/** Filters creators down to those a campaign's hard rules allow. */
export function filterEligibleCreators(
  creators: CreatorProfile[],
  campaign: Campaign,
  options: MatchOptions = {}
): CreatorProfile[] {
  return creators.filter((creator) => matchCreatorToCampaign(creator, campaign, options).eligible);
}
