import { NextResponse } from "next/server";
import { z } from "zod";
import { listCampaigns, saveCampaign } from "@/lib/db/repositories";
import { createId, slug } from "@/lib/marketplace";
import { createRegion } from "@/lib/regions";

export const dynamic = "force-dynamic";

const regionSchema = z.object({
  country: z.string().min(2),
  state: z.string().optional(),
  city: z.string().optional()
});

const schema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  brandName: z.string().optional(),
  product: z.string().default(""),
  goal: z.string().default(""),
  audience: z.string().default(""),
  creatorType: z.string().default(""),
  budget: z.coerce.number().nonnegative().default(0),
  duration: z.string().default("30 days"),
  persona: z.string().optional(),
  targetNiches: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  targetRegions: z.array(regionSchema).default([]),
  regionRequirement: z.enum(["preferred", "required"]).default("preferred"),
  barterPolicy: z.enum(["paid", "flexible", "barter_only"]).default("paid"),
  minFollowers: z.coerce.number().nonnegative().default(0),
  objective: z.enum(["awareness", "engagement", "traffic", "conversions", "ugc"]).default("awareness"),
  targets: z
    .object({
      reach: z.coerce.number().positive().optional(),
      impressions: z.coerce.number().positive().optional(),
      engagementRate: z.coerce.number().positive().max(100).optional(),
      clicks: z.coerce.number().positive().optional(),
      conversions: z.coerce.number().positive().optional(),
      cpmTarget: z.coerce.number().positive().optional(),
      cpaTarget: z.coerce.number().positive().optional()
    })
    .default({}),
  briefAssets: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["image", "video", "document", "link"]),
        url: z.string().url(),
        title: z.string().min(1),
        note: z.string().optional()
      })
    )
    .default([]),
  contentGuidelines: z.string().default(""),
  creatorRequirements: z.string().default(""),
  mustInclude: z.array(z.string()).default([]),
  mustAvoid: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  mentions: z.array(z.string()).default([]),
  usageRights: z.string().default(""),
  submissionDeadline: z.string().default(""),
  deliverables: z.array(z.string()).default([]),
  status: z.enum(["open", "closed"]).default("open")
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaigns = await listCampaigns({
      brandId: searchParams.get("brandId") || undefined,
      status: searchParams.get("status") || undefined
    });
    return NextResponse.json({ campaigns });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid campaign fields are required.", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    // Canonicalise country codes so region matching compares like with like.
    const targetRegions = parsed.data.targetRegions
      .map((region) => createRegion(region.country, region.state, region.city))
      .filter((region): region is NonNullable<typeof region> => region !== null);

    const campaign = await saveCampaign(
      { ...parsed.data, targetRegions, id: parsed.data.id || createId("cmp") },
      parsed.data.brandName ? slug(parsed.data.brandName) : undefined
    );
    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error.";
}
