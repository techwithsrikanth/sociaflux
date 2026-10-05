import { NextResponse } from "next/server";
import { authorizeUrl, isInstagramConfigured } from "@/lib/instagram/graph";
import { encodeState } from "@/lib/instagram/state";
import { normaliseHandle } from "@/lib/marketplace";

export const dynamic = "force-dynamic";

/** Sends the creator to Instagram to authorise the app. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const handle = normaliseHandle(searchParams.get("handle") || "");

  if (!isInstagramConfigured()) {
    return NextResponse.redirect(`${origin}/creator/onboarding?instagram=not_configured`);
  }
  if (!handle) {
    return NextResponse.redirect(`${origin}/creator/onboarding?instagram=missing_handle`);
  }

  return NextResponse.redirect(authorizeUrl(encodeState(handle)));
}
