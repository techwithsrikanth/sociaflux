import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIProvider } from "@/lib/ai/provider";
import { scrapeWebsite } from "@/lib/scrapers/website";

const schema = z.object({
  websiteUrl: z.string().min(3)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "websiteUrl is required." }, { status: 400 });
  }

  const scrape = await scrapeWebsite(parsed.data.websiteUrl);
  const profile = await createAIProvider().analyzeBusiness(scrape);
  return NextResponse.json({ profile, scrape });
}
