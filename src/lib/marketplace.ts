import { createRegion } from "./regions";
import type { Region, RegionRequirement } from "./regions";
import type { CreatorProfile } from "./types";

export type { CreatorContact, Reel } from "./types";

/**
 * How a campaign compensates creators.
 * - `paid`: cash only; barter willingness is ignored when matching.
 * - `flexible`: cash or barter; barter-friendly creators are prioritised.
 * - `barter_only`: product/service exchange only; creators who are not open to
 *   barter are filtered out.
 */
export type BarterPolicy = "paid" | "flexible" | "barter_only";

export const BARTER_POLICY_LABEL: Record<BarterPolicy, string> = {
  paid: "Paid only",
  flexible: "Paid or barter",
  barter_only: "Barter only"
};

/** What the brand is buying with this campaign; drives the projection rates. */
export type CampaignObjective = "awareness" | "engagement" | "traffic" | "conversions" | "ugc";

/** What the brand expects the campaign to deliver. Any field may be left unset. */
export type CampaignTargets = {
  /** Distinct people to reach. */
  reach?: number;
  impressions?: number;
  /** Percentage, e.g. 4.5 for 4.5%. */
  engagementRate?: number;
  clicks?: number;
  conversions?: number;
  /** Ceiling on cost per 1,000 people reached. */
  cpmTarget?: number;
  /** Ceiling on cost per conversion. */
  cpaTarget?: number;
};

export type BriefAssetKind = "image" | "video" | "document" | "link";

/** Reference material showing creators how the ad should look and sound. */
export type BriefAsset = {
  id: string;
  kind: BriefAssetKind;
  url: string;
  title: string;
  note?: string;
};

export const BRIEF_ASSET_LABEL: Record<BriefAssetKind, string> = {
  image: "Image",
  video: "Video",
  document: "Document",
  link: "Link"
};

export const OBJECTIVES: CampaignObjective[] = ["awareness", "engagement", "traffic", "conversions", "ugc"];

export type Campaign = {
  id: string;
  name: string;
  product: string;
  goal: string;
  audience: string;
  creatorType: string;
  budget: number;
  duration: string;
  persona?: string;
  brandName?: string;
  /** What success means for this campaign. */
  objective?: CampaignObjective;
  targets?: CampaignTargets;
  /** Reference images, videos and documents showing how the ad should be made. */
  briefAssets?: BriefAsset[];
  /** Prose direction for the content itself. */
  contentGuidelines?: string;
  /** Who the brand wants, in their own words, beyond the structured filters. */
  creatorRequirements?: string;
  mustInclude?: string[];
  mustAvoid?: string[];
  hashtags?: string[];
  mentions?: string[];
  usageRights?: string;
  submissionDeadline?: string;
  /** Niches the brand wants to hear from. Empty means open to all. */
  targetNiches?: string[];
  /** Free-form tags matched against creator niche/content tags alongside `targetNiches`. */
  tags?: string[];
  minFollowers?: number;
  deliverables?: string[];
  /** Geographic targets. Empty means the campaign is open worldwide. */
  targetRegions?: Region[];
  /** Whether `targetRegions` is a hard filter or a ranking preference. */
  regionRequirement?: RegionRequirement;
  barterPolicy?: BarterPolicy;
  postedAt?: string;
  status?: "open" | "closed";
};

/** Shape of campaigns persisted before region/barter targeting existed. */
type LegacyCampaignFields = { acceptsBarter?: boolean; location?: string };

export type ApplicationStatus = "applied" | "invited" | "shortlisted" | "approved" | "rejected";

export type Application = {
  id: string;
  campaignId: string;
  campaignName: string;
  creatorHandle: string;
  pitch: string;
  quotedPrice: number;
  openToBarter: boolean;
  status: ApplicationStatus;
  appliedAt: string;
  decidedAt?: string;
  brandNote?: string;
};

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  applied: "Applied",
  invited: "Invited",
  shortlisted: "Shortlisted",
  approved: "Approved",
  rejected: "Not selected"
};

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/** Older stored campaigns predate ids and marketplace fields, so every read is normalised. */
export function normaliseCampaign(campaign: Partial<Campaign> & LegacyCampaignFields & { name: string }): Campaign {
  return {
    id: campaign.id || `cmp_${slug(campaign.name)}`,
    name: campaign.name,
    product: campaign.product || "",
    goal: campaign.goal || "",
    audience: campaign.audience || "",
    creatorType: campaign.creatorType || "",
    budget: campaign.budget ?? 0,
    duration: campaign.duration || "30 days",
    persona: campaign.persona,
    brandName: campaign.brandName,
    objective: campaign.objective || "awareness",
    targets: campaign.targets || {},
    briefAssets: campaign.briefAssets || [],
    contentGuidelines: campaign.contentGuidelines || "",
    creatorRequirements: campaign.creatorRequirements || "",
    mustInclude: campaign.mustInclude || [],
    mustAvoid: campaign.mustAvoid || [],
    hashtags: campaign.hashtags || [],
    mentions: campaign.mentions || [],
    usageRights: campaign.usageRights || "",
    submissionDeadline: campaign.submissionDeadline || "",
    targetNiches: campaign.targetNiches || [],
    tags: campaign.tags || [],
    minFollowers: campaign.minFollowers ?? 0,
    deliverables: campaign.deliverables || [],
    // Canonicalise country codes on the way in so region comparison is reliable
    // whatever the caller stored ("India", "in", "IN").
    targetRegions: normaliseRegions(campaign.targetRegions),
    regionRequirement: campaign.regionRequirement || "preferred",
    // Campaigns stored before barterPolicy existed carried a boolean acceptsBarter.
    barterPolicy: campaign.barterPolicy || (campaign.acceptsBarter ? "flexible" : "paid"),
    postedAt: campaign.postedAt || new Date().toISOString(),
    status: campaign.status || "open"
  };
}

/** Drops malformed entries and canonicalises country codes. */
export function normaliseRegions(regions?: Region[]): Region[] {
  return (regions || [])
    .map((region) => createRegion(region.country, region.state, region.city))
    .filter((region): region is Region => region !== null);
}

/** Every tag a campaign wants matched against creator tags. */
export function campaignTags(campaign: Campaign) {
  return [...(campaign.targetNiches || []), ...(campaign.tags || [])].filter(Boolean);
}

/** Barter willingness defaults to false for profiles that never set it. */
export function isOpenForBarter(creator: CreatorProfile) {
  return creator.openForBarter === true;
}

export function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item";
}

export function normaliseHandle(value: string) {
  const trimmed = value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed.toLowerCase() : `@${trimmed.toLowerCase()}`;
}

/** Instagram serves a token-free embed for public posts, which keeps reel previews inline. */
export function instagramEmbedUrl(url: string) {
  const match = url.match(/instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i);
  return match ? `https://www.instagram.com/p/${match[1]}/embed/captioned/` : "";
}

export function creatorNiches(creator: CreatorProfile) {
  return [creator.primaryNiche, ...(creator.subNiches || []), ...creator.secondaryNiches].filter(Boolean);
}

export function matchesNicheFilter(creator: CreatorProfile, niches: string[]) {
  if (!niches.length) return true;
  const owned = creatorNiches(creator).map((niche) => niche.toLowerCase());
  return niches.some((niche) => owned.some((item) => item.includes(niche.toLowerCase()) || niche.toLowerCase().includes(item)));
}

export function creatorAskingPrice(creator: CreatorProfile) {
  return creator.pricing.packagePrice || creator.pricing.reel || creator.pricing.ugcVideo || creator.pricing.staticPost || 0;
}

export function compactNumber(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact" }).format(value);
}

export function timeAgo(iso?: string) {
  if (!iso) return "just now";
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return "just now";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : `${Math.floor(days / 30)}mo ago`;
}
