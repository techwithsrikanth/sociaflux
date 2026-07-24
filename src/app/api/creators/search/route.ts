import { NextResponse } from "next/server";
import { demoCreatorProfiles } from "@/lib/demo-data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const niche = searchParams.get("niche")?.toLowerCase();
  const language = searchParams.get("language")?.toLowerCase();
  const country = searchParams.get("country")?.toLowerCase();
  const maxPrice = Number(searchParams.get("maxPrice") || "0");

  const creators = demoCreatorProfiles.filter((creator) => {
    const matchesNiche = niche ? creator.primaryNiche.toLowerCase().includes(niche) : true;
    const matchesLanguage = language
      ? creator.estimatedAudience.languages.some((item) => item.toLowerCase().includes(language))
      : true;
    const matchesCountry = country
      ? creator.estimatedAudience.geography.some((item) => item.toLowerCase().includes(country))
      : true;
    const matchesPrice = maxPrice ? (creator.pricing.packagePrice || 0) <= maxPrice : true;
    return matchesNiche && matchesLanguage && matchesCountry && matchesPrice;
  });

  return NextResponse.json({ creators });
}
