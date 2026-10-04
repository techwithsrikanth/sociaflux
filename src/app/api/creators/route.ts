import { NextResponse } from "next/server";
import { listCreators, saveCreator } from "@/lib/db/repositories";
import type { CreatorProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ creators: await listCreators() });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

/** Upserts a creator profile. Called whenever onboarding or the portfolio changes. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { creator?: CreatorProfile };
    if (!body.creator?.handle) {
      return NextResponse.json({ error: "A creator with a handle is required." }, { status: 400 });
    }
    return NextResponse.json({ creator: await saveCreator(body.creator) });
  } catch (error) {
    return NextResponse.json({ error: message(error) }, { status: 500 });
  }
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected database error.";
}
