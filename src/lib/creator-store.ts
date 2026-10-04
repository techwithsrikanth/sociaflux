import { normaliseHandle } from "./marketplace";
import type { CreatorProfile } from "./types";

export const STORAGE_KEYS = {
  creatorProfile: "sf.creatorProfile",
  creators: "sf.creators",
  creatorHandle: "sf.creatorHandle",
  creatorPersonaReady: "sf.creatorPersonaReady",
  creatorAnswers: "sf.creatorAnswers",
  applications: "sf.applications",
  brandName: "sf.brandName"
};

/** A profile skeleton for a creator who just signed in and has not been analysed yet. */
export function emptyCreatorProfile(handle: string, name: string, email: string): CreatorProfile {
  const cleanHandle = normaliseHandle(handle);
  return {
    name: name || cleanHandle.replace("@", ""),
    handle: cleanHandle,
    bio: "",
    primaryNiche: "",
    subNiches: [],
    contentLanguages: ["English"],
    reels: [],
    contact: { email, phone: "", city: "", country: "" },
    openForBarter: false,
    secondaryNiches: [],
    topicsDiscussed: [],
    contentPillars: [],
    contentStyles: [],
    brandPersonality: [],
    estimatedAudience: { ageGroups: [], interests: [], geography: [], languages: ["English"] },
    contentQuality: { imageQuality: "Unknown", videoQuality: "Unknown", editingQuality: "Unknown", brandingConsistency: "Unknown", postingConsistency: "Unknown" },
    postingBehaviour: { approximateFrequency: "Unknown", dominantFormat: "Reel", captionStyle: "Unknown", hashtagUsage: "Unknown" },
    brandSafety: { profanityRisk: "Unknown", politicalContent: "Unknown", sensitiveTopics: "Unknown", adultContentIndicators: "Unknown", overallScore: 70 },
    previousCollaborations: { detectedSponsoredContent: [], mentionedBrands: [], productCategories: [] },
    pricing: { currency: "USD" },
    summary: `${cleanHandle} has not completed creator onboarding yet.`,
    embeddingText: cleanHandle,
    rawData: {}
  };
}

function read<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

/**
 * Handle-based sign-in. Loads the creator out of the shared directory when they
 * already exist, otherwise seeds a blank profile so onboarding starts clean.
 */
export function signInCreator(handleInput: string, name: string, email: string) {
  const handle = normaliseHandle(handleInput);
  if (!handle) return "";
  const directory = read<CreatorProfile[]>(STORAGE_KEYS.creators, []);
  const existing = directory.find((creator) => creator.handle === handle);
  const profile = existing || emptyCreatorProfile(handle, name, email);
  if (!existing && email && profile.contact) profile.contact.email = email;

  write(STORAGE_KEYS.creatorHandle, handle);
  write(STORAGE_KEYS.creatorProfile, profile);
  if (!existing) {
    write(STORAGE_KEYS.creatorPersonaReady, false);
    write(STORAGE_KEYS.creatorAnswers, []);
  }
  return handle;
}

export function signInBrand(brandName: string) {
  if (brandName) write(STORAGE_KEYS.brandName, brandName);
}
