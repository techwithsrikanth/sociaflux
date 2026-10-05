import { NextResponse } from "next/server";
import { exchangeCodeForToken, exchangeForLongLivedToken, fetchInstagramProfile, isInstagramConfigured } from "@/lib/instagram/graph";
import { decodeState } from "@/lib/instagram/state";
import { getCreator, saveCreator, saveInstagramConnection } from "@/lib/db/repositories";
import { emptyCreatorProfile } from "@/lib/creator-store";

export const dynamic = "force-dynamic";

/** Instagram redirects here after the creator approves or denies. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const back = (status: string) => NextResponse.redirect(`${origin}/creator/onboarding?instagram=${status}`);

  if (!isInstagramConfigured()) return back("not_configured");
  if (searchParams.get("error")) return back("denied");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) return back("missing_code");

  const decoded = decodeState(state);
  if (!decoded) return back("bad_state");

  try {
    const shortLived = await exchangeCodeForToken(code);
    const token = await exchangeForLongLivedToken(shortLived);
    const instagram = await fetchInstagramProfile(token.accessToken);

    // Meta only returns metrics for Business and Creator accounts.
    if (instagram.accountType && !/BUSINESS|CREATOR/i.test(instagram.accountType)) {
      return back("wrong_account_type");
    }

    // The authorised account is the source of truth for the handle.
    const handle = instagram.username ? `@${instagram.username.toLowerCase()}` : decoded.handle;
    const existing = (await getCreator(handle)) || (await getCreator(decoded.handle));

    const profile = {
      ...(existing || emptyCreatorProfile(handle, instagram.name || instagram.username, "")),
      handle,
      name: instagram.name || instagram.username || handle,
      bio: instagram.biography || existing?.bio || "",
      profileImage: instagram.profilePictureUrl || existing?.profileImage,
      publicFollowerCount: instagram.followersCount,
      publicFollowingCount: instagram.followsCount,
      publicPostCount: instagram.mediaCount,
      verified: true,
      instagram: { userId: instagram.userId, connectedAt: new Date().toISOString() }
    };

    await saveCreator(profile);
    await saveInstagramConnection(handle, {
      userId: instagram.userId,
      accessToken: token.accessToken,
      expiresAt: token.expiresAt
    });

    return NextResponse.redirect(`${origin}/creator/onboarding?instagram=connected&handle=${encodeURIComponent(handle)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    return NextResponse.redirect(`${origin}/creator/onboarding?instagram=failed&reason=${encodeURIComponent(message.slice(0, 120))}`);
  }
}
