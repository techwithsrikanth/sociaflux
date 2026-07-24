import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  productName: z.string().min(1),
  productDescription: z.string().min(1),
  landingPage: z.string().optional(),
  price: z.string().optional(),
  campaignGoal: z.string().min(1),
  targetAudience: z.string().min(1),
  preferredCreatorType: z.string().min(1),
  budget: z.coerce.number().nonnegative(),
  duration: z.string().min(1),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Valid campaign fields are required." }, { status: 400 });
  }

  const profile = {
    ...parsed.data,
    productImages: [],
    summary: `${parsed.data.productName} campaign for ${parsed.data.targetAudience}. Goal: ${parsed.data.campaignGoal}.`,
    embeddingText: [
      parsed.data.productName,
      parsed.data.productDescription,
      parsed.data.campaignGoal,
      parsed.data.targetAudience,
      parsed.data.preferredCreatorType
    ].join(" ")
  };

  return NextResponse.json({ campaign: profile });
}
