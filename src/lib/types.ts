import type { ContentFormat } from "./niches";
import type { Region } from "./regions";

export type Reel = {
  id: string;
  url: string;
  title: string;
  format: ContentFormat;
  niche: string;
  views?: number;
  likes?: number;
  comments?: number;
  brand?: string;
  addedAt: string;
};

export type CreatorContact = {
  email: string;
  phone: string;
  city: string;
  country: string;
  managerEmail?: string;
};

export type JsonRecord = Record<string, unknown>;

export type BusinessProfile = {
  businessName: string;
  website: string;
  logoUrl?: string;
  description: string;
  industry: string;
  category: string;
  products: string[];
  services: string[];
  targetAudience: string[];
  brandTone: string[];
  pricePositioning: string;
  country: string;
  languages: string[];
  socialLinks: string[];
  visualStyle: string[];
  keywords: string[];
  primaryValueProposition: string;
  uniqueSellingPoints: string[];
  brandPersonality: string[];
  estimatedCustomerPersona: string[];
  importantPages: string[];
  contactInformation: string[];
  frequentlyMentionedTerms: string[];
  summary: string;
  embeddingText: string;
  rawData: JsonRecord;
};

export type CampaignProfile = {
  productName: string;
  productDescription: string;
  productImages: string[];
  landingPage?: string;
  price?: string;
  campaignGoal: string;
  targetAudience: string;
  preferredCreatorType: string;
  budget: number;
  duration: string;
  notes?: string;
  summary: string;
  embeddingText: string;
};

export type CreatorPricing = {
  story?: number;
  reel?: number;
  staticPost?: number;
  carousel?: number;
  ugcVideo?: number;
  packagePrice?: number;
  currency: string;
};

export type CreatorProfile = {
  name: string;
  handle: string;
  bio: string;
  website?: string;
  profileImage?: string;
  publicFollowerCount?: number;
  publicFollowingCount?: number;
  publicPostCount?: number;
  /** Measured over recent posts by Business Discovery, not estimated from followers. */
  publicAvgLikes?: number;
  publicAvgComments?: number;
  primaryNiche: string;
  /** Niches picked from the taxonomy during onboarding, alongside the AI-inferred secondaryNiches. */
  subNiches?: string[];
  contentLanguages?: string[];
  /** Portfolio work a brand reviews after shortlisting. */
  reels?: Reel[];
  /** Hidden from brands until an application is approved. */
  contact?: CreatorContact;
  /**
   * Where the creator is based. Public, unlike `contact`, because campaigns
   * filter and score on it. Defaults to undefined ("not stated").
   */
  location?: Region;
  /**
   * Whether the creator accepts product/service exchange instead of paid briefs
   * only. Defaults to false; see `isOpenForBarter`.
   */
  openForBarter?: boolean;
  /** True once the creator connected Instagram and the numbers came from Meta. */
  verified?: boolean;
  /** Connection metadata. The access token is never included here. */
  instagram?: { userId: string; connectedAt?: string };
  secondaryNiches: string[];
  topicsDiscussed: string[];
  contentPillars: string[];
  contentStyles: string[];
  brandPersonality: string[];
  estimatedAudience: {
    ageGroups: string[];
    interests: string[];
    geography: string[];
    languages: string[];
  };
  contentQuality: {
    imageQuality: string;
    videoQuality: string;
    editingQuality: string;
    brandingConsistency: string;
    postingConsistency: string;
  };
  postingBehaviour: {
    approximateFrequency: string;
    dominantFormat: string;
    captionStyle: string;
    hashtagUsage: string;
  };
  brandSafety: {
    profanityRisk: string;
    politicalContent: string;
    sensitiveTopics: string;
    adultContentIndicators: string;
    overallScore: number;
  };
  previousCollaborations: {
    detectedSponsoredContent: string[];
    mentionedBrands: string[];
    productCategories: string[];
  };
  pricing: CreatorPricing;
  summary: string;
  embeddingText: string;
  rawData: JsonRecord;
};

export type MatchResult = {
  creatorHandle: string;
  score: number;
  confidenceLevel: "Low" | "Medium" | "High";
  reasons: string[];
  riskFactors: string[];
  suggestedCollaboration: string;
  estimatedRoiConfidence: "Low" | "Medium" | "High";
};

export type ScrapeResult = {
  sourceUrl: string;
  status: "complete" | "limited" | "failed";
  title?: string;
  description?: string;
  headings: string[];
  links: string[];
  images: string[];
  socialLinks: string[];
  contactHints: string[];
  textSample: string;
  limitations: string[];
};
