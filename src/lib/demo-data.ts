import type { BusinessProfile, CreatorProfile, MatchResult } from "./types";

export const demoBusinessProfile: BusinessProfile = {
  businessName: "Aura Atelier",
  website: "https://aura-atelier.example",
  logoUrl: "",
  description: "A direct-to-consumer skincare studio focused on gentle routines for sensitive skin.",
  industry: "Beauty and personal care",
  category: "Skincare",
  products: ["Barrier repair serum", "Mineral SPF", "Fragrance-free cleanser"],
  services: ["Skin routine education", "Online consultations"],
  targetAudience: ["Women 24-40", "Sensitive skin buyers", "Ingredient-conscious shoppers"],
  brandTone: ["Calm", "Expert", "Transparent"],
  pricePositioning: "Premium accessible",
  country: "United States",
  languages: ["English"],
  socialLinks: ["https://instagram.com/auraatelier"],
  visualStyle: ["Clean product photography", "Soft contrast", "Ingredient-led layouts"],
  keywords: ["sensitive skin", "barrier repair", "dermatologist tested", "fragrance free"],
  primaryValueProposition: "Evidence-led skincare that simplifies sensitive-skin routines.",
  uniqueSellingPoints: ["Fragrance-free formulas", "Ingredient transparency", "Routine-first education"],
  brandPersonality: ["Minimal", "Professional", "Trustworthy", "Warm"],
  estimatedCustomerPersona: ["Busy professionals", "Skincare beginners", "Research-heavy buyers"],
  importantPages: ["/products", "/ingredients", "/routine-builder"],
  contactInformation: ["hello@aura-atelier.example"],
  frequentlyMentionedTerms: ["barrier", "gentle", "clinical", "routine"],
  summary:
    "Aura Atelier is best matched with creators who can explain skincare calmly, demonstrate product use clearly, and maintain a brand-safe, ingredient-aware voice.",
  embeddingText:
    "Beauty skincare sensitive skin barrier repair fragrance free calm expert transparent premium accessible ingredient education routine.",
  rawData: {
    retrieval: "Demo seed generated from MVP sample"
  }
};

export const demoCreatorProfiles: CreatorProfile[] = [
  {
    name: "Maya Chen",
    handle: "@mayaskinnotes",
    bio: "Sensitive skin routines, ingredient explainers, and gentle product reviews.",
    website: "https://mayaskinnotes.example",
    profileImage: "",
    publicFollowerCount: 84200,
    publicFollowingCount: 618,
    publicPostCount: 412,
    primaryNiche: "Skincare education",
    secondaryNiches: ["Beauty", "Wellness", "Product reviews"],
    topicsDiscussed: ["Sensitive skin", "Barrier repair", "SPF", "Ingredient literacy"],
    contentPillars: ["Explainers", "Routine demos", "Before-after diaries", "Product reviews"],
    contentStyles: ["Educational", "Reviews", "Tutorials", "Storytelling"],
    brandPersonality: ["Minimal", "Professional", "Authentic", "Friendly"],
    estimatedAudience: {
      ageGroups: ["24-34", "35-44"],
      interests: ["Skincare", "Beauty science", "Low-irritation products"],
      geography: ["United States", "Canada", "United Kingdom"],
      languages: ["English"]
    },
    contentQuality: {
      imageQuality: "High",
      videoQuality: "High",
      editingQuality: "Polished but natural",
      brandingConsistency: "Strong",
      postingConsistency: "Consistent"
    },
    postingBehaviour: {
      approximateFrequency: "4-5 posts per week",
      dominantFormat: "Reels and carousel explainers",
      captionStyle: "Detailed, practical, evidence-aware",
      hashtagUsage: "Moderate and niche-specific"
    },
    brandSafety: {
      profanityRisk: "Low",
      politicalContent: "None detected",
      sensitiveTopics: "Low",
      adultContentIndicators: "None detected",
      overallScore: 94
    },
    previousCollaborations: {
      detectedSponsoredContent: ["SPF routine reel", "Serum review carousel"],
      mentionedBrands: ["Byoma", "KraveBeauty", "La Roche-Posay"],
      productCategories: ["Serums", "Cleansers", "SPF"]
    },
    pricing: {
      story: 450,
      reel: 2200,
      staticPost: 950,
      carousel: 1400,
      ugcVideo: 1300,
      packagePrice: 3600,
      currency: "USD"
    },
    summary:
      "Maya is an ingredient-aware skincare educator with a brand-safe tone and strong fit for sensitive-skin launches.",
    embeddingText:
      "Skincare education sensitive skin barrier repair SPF ingredient literacy educational reviews tutorials minimal professional authentic.",
    rawData: {
      source: "Demo public profile approximation"
    }
  },
  {
    name: "Leo Grant",
    handle: "@leograntfit",
    bio: "Fast workouts, meal prep, and no-fluff product tests.",
    website: "",
    profileImage: "",
    publicFollowerCount: 126000,
    publicFollowingCount: 883,
    publicPostCount: 730,
    primaryNiche: "Fitness",
    secondaryNiches: ["Nutrition", "Men's lifestyle"],
    topicsDiscussed: ["Strength training", "Meal prep", "Supplements", "Habit building"],
    contentPillars: ["Workout demos", "Product tests", "Challenge formats"],
    contentStyles: ["Entertainment", "Reviews", "Tutorials", "Lifestyle"],
    brandPersonality: ["Energetic", "Bold", "Fun", "Authentic"],
    estimatedAudience: {
      ageGroups: ["18-24", "25-34"],
      interests: ["Fitness", "Protein snacks", "Performance gear"],
      geography: ["United States", "Australia"],
      languages: ["English"]
    },
    contentQuality: {
      imageQuality: "Medium",
      videoQuality: "High",
      editingQuality: "Fast-paced",
      brandingConsistency: "Medium",
      postingConsistency: "High"
    },
    postingBehaviour: {
      approximateFrequency: "Daily",
      dominantFormat: "Short reels",
      captionStyle: "Short, punchy, challenge-driven",
      hashtagUsage: "Heavy"
    },
    brandSafety: {
      profanityRisk: "Medium",
      politicalContent: "None detected",
      sensitiveTopics: "Low",
      adultContentIndicators: "None detected",
      overallScore: 78
    },
    previousCollaborations: {
      detectedSponsoredContent: ["Protein bar test", "Gymwear haul"],
      mentionedBrands: ["Gymshark", "MyProtein"],
      productCategories: ["Supplements", "Athleisure", "Equipment"]
    },
    pricing: {
      story: 700,
      reel: 3200,
      staticPost: 1200,
      carousel: 1600,
      ugcVideo: 1900,
      packagePrice: 5200,
      currency: "USD"
    },
    summary:
      "Leo is a high-energy fitness creator best suited to performance, nutrition, and challenge-led campaigns.",
    embeddingText:
      "Fitness nutrition workouts meal prep supplements energetic bold entertaining product tests reels.",
    rawData: {
      source: "Demo public profile approximation"
    }
  },
  {
    name: "Nora Valdez",
    handle: "@norahomeedit",
    bio: "Small-space home styling, affordable upgrades, and calm interiors.",
    website: "https://norahomeedit.example",
    profileImage: "",
    publicFollowerCount: 39200,
    publicFollowingCount: 402,
    publicPostCount: 288,
    primaryNiche: "Home decor",
    secondaryNiches: ["Lifestyle", "Budget design"],
    topicsDiscussed: ["Small spaces", "Storage", "Renter-friendly design", "Minimal interiors"],
    contentPillars: ["Room makeovers", "Product finds", "Before-after content"],
    contentStyles: ["Lifestyle", "Tutorials", "Storytelling", "Product reviews"],
    brandPersonality: ["Minimal", "Friendly", "Inspirational", "Authentic"],
    estimatedAudience: {
      ageGroups: ["25-34", "35-44"],
      interests: ["Home decor", "Organization", "Affordable design"],
      geography: ["United States"],
      languages: ["English", "Spanish"]
    },
    contentQuality: {
      imageQuality: "High",
      videoQuality: "Medium",
      editingQuality: "Clean",
      brandingConsistency: "Strong",
      postingConsistency: "Medium"
    },
    postingBehaviour: {
      approximateFrequency: "3 posts per week",
      dominantFormat: "Carousels and reels",
      captionStyle: "Warm, practical, story-led",
      hashtagUsage: "Moderate"
    },
    brandSafety: {
      profanityRisk: "Low",
      politicalContent: "None detected",
      sensitiveTopics: "Low",
      adultContentIndicators: "None detected",
      overallScore: 91
    },
    previousCollaborations: {
      detectedSponsoredContent: ["Shelf styling reel", "Storage basket carousel"],
      mentionedBrands: ["IKEA", "Target", "The Container Store"],
      productCategories: ["Home decor", "Storage", "Furniture"]
    },
    pricing: {
      story: 250,
      reel: 1050,
      staticPost: 650,
      carousel: 900,
      ugcVideo: 850,
      packagePrice: 2200,
      currency: "USD"
    },
    summary:
      "Nora brings calm, practical home styling and fits brands selling approachable lifestyle or interiors products.",
    embeddingText:
      "Home decor lifestyle small space storage minimal calm interiors product reviews budget design.",
    rawData: {
      source: "Demo public profile approximation"
    }
  }
];

export const demoMatches: MatchResult[] = [
  {
    creatorHandle: "@mayaskinnotes",
    score: 94,
    confidenceLevel: "High",
    reasons: [
      "Strong overlap with sensitive-skin audience",
      "Educational style supports ingredient-led positioning",
      "Minimal, professional tone matches the brand",
      "Pricing fits a premium accessible launch package",
      "High brand safety score"
    ],
    riskFactors: ["Limited public sales conversion data"],
    suggestedCollaboration: "Ingredient explainer reel plus routine carousel",
    estimatedRoiConfidence: "High"
  },
  {
    creatorHandle: "@norahomeedit",
    score: 51,
    confidenceLevel: "Medium",
    reasons: [
      "Brand-safe and calm creator personality",
      "Some overlap with premium lifestyle shoppers"
    ],
    riskFactors: ["Primary niche is home decor, not skincare", "Audience intent may be weak"],
    suggestedCollaboration: "UGC-only lifestyle bathroom routine video",
    estimatedRoiConfidence: "Medium"
  },
  {
    creatorHandle: "@leograntfit",
    score: 37,
    confidenceLevel: "Low",
    reasons: ["Large audience and strong posting consistency"],
    riskFactors: [
      "Fitness audience has low niche overlap",
      "Energetic tone conflicts with calm skincare positioning",
      "Medium profanity risk"
    ],
    suggestedCollaboration: "Skip for launch; reconsider for men's SPF angle",
    estimatedRoiConfidence: "Low"
  }
];

export const demoBusinesses = [
  {
    user: { email: "founder@aura-atelier.example" },
    name: demoBusinessProfile.businessName,
    website: demoBusinessProfile.website,
    country: demoBusinessProfile.country,
    language: demoBusinessProfile.languages[0],
    profile: {
      description: demoBusinessProfile.description,
      industry: demoBusinessProfile.industry,
      category: demoBusinessProfile.category,
      products: demoBusinessProfile.products,
      services: demoBusinessProfile.services,
      targetAudience: demoBusinessProfile.targetAudience,
      brandTone: demoBusinessProfile.brandTone,
      pricePositioning: demoBusinessProfile.pricePositioning,
      socialLinks: demoBusinessProfile.socialLinks,
      visualStyle: demoBusinessProfile.visualStyle,
      keywords: demoBusinessProfile.keywords,
      primaryValueProposition: demoBusinessProfile.primaryValueProposition,
      uniqueSellingPoints: demoBusinessProfile.uniqueSellingPoints,
      brandPersonality: demoBusinessProfile.brandPersonality,
      estimatedCustomerPersona: demoBusinessProfile.estimatedCustomerPersona,
      importantPages: demoBusinessProfile.importantPages,
      contactInformation: demoBusinessProfile.contactInformation,
      frequentlyMentionedTerms: demoBusinessProfile.frequentlyMentionedTerms,
      summary: demoBusinessProfile.summary,
      embeddingText: demoBusinessProfile.embeddingText,
      rawData: demoBusinessProfile.rawData
    },
    products: [
      {
        name: "Barrier Reset Serum",
        description: "A fragrance-free serum for irritated and over-exfoliated skin.",
        imageUrls: [],
        landingPage: "https://aura-atelier.example/products/barrier-reset",
        price: "$48"
      }
    ],
    campaigns: [
      {
        name: "Barrier Reset Launch",
        goal: "Drive qualified awareness and routine education",
        targetAudience: "Sensitive skin shoppers aged 24-40",
        preferredCreatorType: "Skincare educator with calm, clinical tone",
        budget: 6000,
        notes: "Prioritize reels and carousel explainers."
      }
    ]
  }
];

export const demoCreators = demoCreatorProfiles.map((profile) => ({
  user: { email: `${profile.handle.replace("@", "")}@creator.example` },
  name: profile.name,
  handle: profile.handle,
  website: profile.website,
  country: profile.estimatedAudience.geography[0],
  language: profile.estimatedAudience.languages[0],
  pricing: profile.pricing,
  profile: {
    bio: profile.bio,
    profileImage: profile.profileImage,
    publicFollowerCount: profile.publicFollowerCount,
    publicFollowingCount: profile.publicFollowingCount,
    publicPostCount: profile.publicPostCount,
    primaryNiche: profile.primaryNiche,
    secondaryNiches: profile.secondaryNiches,
    topicsDiscussed: profile.topicsDiscussed,
    contentPillars: profile.contentPillars,
    contentStyles: profile.contentStyles,
    brandPersonality: profile.brandPersonality,
    estimatedAudience: profile.estimatedAudience,
    contentQuality: profile.contentQuality,
    postingBehaviour: profile.postingBehaviour,
    brandSafety: profile.brandSafety,
    previousCollaborations: profile.previousCollaborations,
    summary: profile.summary,
    embeddingText: profile.embeddingText,
    rawData: profile.rawData
  }
}));
