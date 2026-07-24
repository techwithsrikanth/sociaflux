import type { BusinessProfile, CreatorProfile, MatchResult } from "./types";

export function computeMatch(business: BusinessProfile, creator: CreatorProfile, budget?: number): MatchResult {
  const reasons: string[] = [];
  const riskFactors: string[] = [];
  let score = 20;

  const businessTerms = termSet([
    business.industry,
    business.category,
    ...business.keywords,
    ...business.products,
    ...business.services,
    ...business.brandTone,
    ...business.brandPersonality,
    ...business.targetAudience
  ]);
  const creatorTerms = termSet([
    creator.primaryNiche,
    ...creator.secondaryNiches,
    ...creator.topicsDiscussed,
    ...creator.contentPillars,
    ...creator.contentStyles,
    ...creator.brandPersonality,
    ...creator.estimatedAudience.interests
  ]);

  const overlap = [...businessTerms].filter((term) => creatorTerms.has(term));
  score += Math.min(30, overlap.length * 6);

  if (overlap.length >= 3) {
    reasons.push(`Audience and niche overlap on ${overlap.slice(0, 4).join(", ")}.`);
  } else {
    riskFactors.push("Limited public niche overlap was detected.");
  }

  const toneOverlap = business.brandPersonality.filter((trait) =>
    creator.brandPersonality.map((item) => item.toLowerCase()).includes(trait.toLowerCase())
  );
  score += Math.min(16, toneOverlap.length * 8);

  if (toneOverlap.length) {
    reasons.push(`Brand personality match: ${toneOverlap.join(", ")}.`);
  } else {
    riskFactors.push("Creator personality may need manual tone review.");
  }

  if (creator.brandSafety.overallScore >= 90) {
    score += 14;
    reasons.push("High brand safety score supports low-risk collaboration.");
  } else if (creator.brandSafety.overallScore >= 75) {
    score += 7;
    reasons.push("Brand safety appears acceptable with some review.");
  } else {
    riskFactors.push("Brand safety score is below preferred threshold.");
  }

  if (budget && creator.pricing.packagePrice) {
    if (creator.pricing.packagePrice <= budget) {
      score += 12;
      reasons.push("Package pricing is within campaign budget.");
    } else {
      score -= 10;
      riskFactors.push("Package pricing exceeds campaign budget.");
    }
  }

  if (creator.previousCollaborations.productCategories.some((category) => business.category.toLowerCase().includes(category.toLowerCase()))) {
    score += 8;
    reasons.push("Previous collaborations include a similar product category.");
  }

  if (creator.publicFollowerCount && creator.publicFollowerCount > 25000) {
    score += 5;
    reasons.push("Creator has enough visible audience scale for MVP discovery.");
  }

  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  return {
    creatorHandle: creator.handle,
    score: finalScore,
    confidenceLevel: finalScore >= 78 ? "High" : finalScore >= 55 ? "Medium" : "Low",
    reasons: reasons.length ? reasons : ["Some broad positioning overlap was detected."],
    riskFactors: riskFactors.length ? riskFactors : ["No major risks detected from available public information."],
    suggestedCollaboration: suggestFormat(creator),
    estimatedRoiConfidence: finalScore >= 78 ? "High" : finalScore >= 55 ? "Medium" : "Low"
  };
}

function termSet(values: string[]) {
  return new Set(
    values
      .flatMap((value) => value.toLowerCase().split(/[^a-z0-9]+/))
      .filter((value) => value.length > 3)
  );
}

function suggestFormat(creator: CreatorProfile) {
  if (creator.contentStyles.includes("Tutorials")) return "Tutorial reel with educational carousel";
  if (creator.contentStyles.includes("Reviews")) return "Product review reel plus story Q&A";
  if (creator.contentStyles.includes("Lifestyle")) return "Lifestyle integration with UGC video";
  return "Sponsored reel with usage narrative";
}
