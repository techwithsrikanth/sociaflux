import { NextResponse } from "next/server";
import { intersectTags } from "@/lib/campaign-matching";
import { searchCreators } from "@/lib/db/repositories";
import { toCountryCode } from "@/lib/regions";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get("language")?.toLowerCase();
    const tags = searchParams.getAll("tag").filter(Boolean);
    const country = searchParams.get("country");

    // Column filters run in SQL; language and tag matching need the domain logic.
    const creators = await searchCreators({
      niche: searchParams.get("niche") || undefined,
      country: country ? toCountryCode(country) : undefined,
      state: searchParams.get("state") || undefined,
      city: searchParams.get("city") || undefined,
      openForBarter: searchParams.get("openForBarter") === "true",
      minFollowers: Number(searchParams.get("minFollowers") || "0") || undefined,
      maxPrice: Number(searchParams.get("maxPrice") || "0") || undefined
    });

    const filtered = creators.filter((creator) => {
      const matchesLanguage = language
        ? creator.estimatedAudience.languages.some((item) => item.toLowerCase().includes(language))
        : true;
      const matchesTags = tags.length
        ? intersectTags(tags, [creator.primaryNiche, ...(creator.subNiches || []), ...creator.secondaryNiches]).length > 0
        : true;
      return matchesLanguage && matchesTags;
    });

    return NextResponse.json({ creators: filtered });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected database error." }, { status: 500 });
  }
}
