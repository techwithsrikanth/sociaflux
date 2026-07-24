import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIProvider } from "@/lib/ai/provider";
import { scrapeInstagramPublicProfile } from "@/lib/scrapers/instagram";

const schema = z.object({
  handleOrUrl: z.string().min(2)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "handleOrUrl is required." }, { status: 400 });
  }

  const scrape = await scrapeInstagramPublicProfile(parsed.data.handleOrUrl);
  const profile = await createAIProvider().analyzeCreator(scrape);
  return NextResponse.json({ profile, scrape });
}
