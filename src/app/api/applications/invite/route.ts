import { NextResponse } from "next/server";
import { inviteApplication } from "@/lib/db/repositories";
import { createId } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

/**
 * Brand reaching out to a creator from discovery, for a specific campaign.
 *
 * The invitation is an interest signal, not a priced deal: rate and
 * deliverables are agreed between the two over email once the creator accepts
 * and their contact unlocks.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { campaignId?: string; campaignName?: string; creatorHandle?: string; brandNote?: string };
    if (!body.campaignId || !body.creatorHandle) {
      return NextResponse.json({ error: "campaignId and creatorHandle are required." }, { status: 400 });
    }

    const result = await inviteApplication({
      id: createId("app"),
      campaignId: body.campaignId,
      campaignName: body.campaignName || "",
      creatorHandle: body.creatorHandle,
      brandNote: body.brandNote
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unexpected database error." }, { status: 500 });
  }
}
