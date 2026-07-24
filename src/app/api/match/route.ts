import { NextResponse } from "next/server";
import { z } from "zod";
import { createAIProvider } from "@/lib/ai/provider";
import type { BusinessProfile, CreatorProfile } from "@/lib/types";

const schema = z.object({
  business: z.unknown(),
  creators: z.array(z.unknown()),
  budget: z.number().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "business and creators are required." }, { status: 400 });
  }

  const provider = createAIProvider();
  const matches = await Promise.all(
    parsed.data.creators.map((creator) =>
      provider.matchBusinessToCreator(parsed.data.business as BusinessProfile, creator as CreatorProfile, parsed.data.budget)
    )
  );

  return NextResponse.json({ matches: matches.sort((left, right) => right.score - left.score) });
}
