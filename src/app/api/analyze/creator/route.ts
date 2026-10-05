import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIProvider } from "@/lib/ai/provider";
import { discoverInstagramProfile, discoveryToScrapeResult } from "@/lib/instagram/discovery";
import { scrapeInstagramPublicProfile } from "@/lib/scrapers/instagram";

const schema = z.object({
  handleOrUrl: z.string().min(2)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "handleOrUrl is required." }, { status: 400 });
  }

  // Business Discovery first: it is authenticated, so it works from a server
  // and returns exact numbers. It only covers public professional accounts, so
  // scraping stays as the fallback for everyone else.
  const discovered = await discoverInstagramProfile(parsed.data.handleOrUrl);
  const scrape = discovered ? discoveryToScrapeResult(discovered) : await scrapeInstagramPublicProfile(parsed.data.handleOrUrl);

  const profile = await createAIProvider().analyzeCreator(scrape);
  return NextResponse.json({ profile, scrape, source: discovered ? "business_discovery" : "public_page" });
}
