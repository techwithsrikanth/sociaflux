import { NextResponse } from "next/server";
import { getCreator, inviteApplication } from "@/lib/db/repositories";
import { createId } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

/** Brand reaching out to a creator from discovery, for a specific campaign. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { campaignId?: string; campaignName?: string; creatorHandle?: string; brandNote?: string; quotedPrice?: number };
    if (!body.campaignId || !body.creatorHandle) {
      return NextResponse.json({ error: "campaignId and creatorHandle are required." }, { status: 400 });
    }

    // The invitation is made at the creator's own rate, so accepting means they
    // took the campaign at that price. Prefer a price the brand passed, else the
    // creator's package rate from their profile.
    const creator = await getCreator(body.creatorHandle);
    const quotedPrice = body.quotedPrice || creator?.pricing?.packagePrice || 0;

    const result = await inviteApplication({
      id: createId("app"),
      campaignId: body.campaignId,
      campaignName: body.campaignName || "",
      creatorHandle: body.creatorHandle,
      quotedPrice,
      brandNote: body.brandNote
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected database error." }, { status: 500 });
  }
}
