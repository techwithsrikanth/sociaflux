import { NextResponse } from "next/server";
import { z } from "zod";
import { rankCreatorsForCampaign } from "@/lib/campaign-matching";
import { demoCreatorProfiles } from "@/lib/demo-data";
import { normaliseCampaign } from "@/lib/marketplace";
import type { Campaign } from "@/lib/marketplace";
import type { CreatorProfile } from "@/lib/types";

const schema = z.object({
  campaign: z.unknown(),
  creators: z.array(z.unknown()).optional(),
  requireRegionMatch: z.boolean().optional(),
  eligibleOnly: z.boolean().optional()
});

/** Ranks creators against one campaign on tag, region and barter fit. */
export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  const rawCampaign = parsed.success ? (parsed.data.campaign as Partial<Campaign> | undefined) : undefined;
  if (!parsed.success || !rawCampaign?.name) {
    return NextResponse.json({ error: "A campaign with a name is required." }, { status: 400 });
  }

  const campaign = normaliseCampaign({ ...rawCampaign, name: rawCampaign.name });
  const creators = (parsed.data.creators as CreatorProfile[] | undefined) || demoCreatorProfiles;
  const matches = rankCreatorsForCampaign(creators, campaign, {
    requireRegionMatch: parsed.data.requireRegionMatch
  });

  return NextResponse.json({
    campaign,
    matches: parsed.data.eligibleOnly ? matches.filter((match) => match.eligible) : matches
  });
}
