/**
 * Instagram API with Instagram Login.
 *
 * Creators authorise the app and we read their own profile metrics. Unlike
 * scraping the public page, this works from a server, because the request is
 * authenticated rather than anonymous.
 *
 * Only Business and Creator accounts are supported by Meta; personal accounts
 * return nothing.
 */

const AUTH_HOST = "https://www.instagram.com";
const GRAPH_HOST = "https://graph.instagram.com";
const GRAPH_VERSION = "v21.0";

/** Everything the profile card needs. */
const PROFILE_FIELDS = [
  "user_id",
  "username",
  "name",
  "account_type",
  "followers_count",
  "follows_count",
  "media_count",
  "profile_picture_url",
  "biography"
].join(",");

/** Minimum scope that returns follower and media counts. */
export const INSTAGRAM_SCOPE = "instagram_business_basic";

export type InstagramProfile = {
  userId: string;
  username: string;
  name?: string;
  accountType?: string;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
  profilePictureUrl?: string;
  biography?: string;
};

export type InstagramToken = {
  accessToken: string;
  /** ISO timestamp; long-lived tokens last about 60 days. */
  expiresAt: string;
};

export function instagramConfig() {
  return {
    appId: process.env.SOCIAFLUX_INSTAGRAM_APP_ID?.trim() || "",
    appSecret: process.env.SOCIAFLUX_INSTAGRAM_APP_SECRET?.trim() || "",
    redirectUri: process.env.SOCIAFLUX_INSTAGRAM_REDIRECT_URI?.trim() || ""
  };
}

export function isInstagramConfigured() {
  const { appId, appSecret, redirectUri } = instagramConfig();
  return Boolean(appId && appSecret && redirectUri);
}

/** Where to send the creator to authorise. */
export function authorizeUrl(state: string) {
  const { appId, redirectUri } = instagramConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_SCOPE,
    state
  });
  return `${AUTH_HOST}/oauth/authorize?${params.toString()}`;
}

async function readJson(response: Response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = (body as { error_message?: string; error?: { message?: string } });
    throw new Error(detail.error_message || detail.error?.message || `Instagram returned ${response.status}`);
  }
  return body as Record<string, unknown>;
}

/** Step 1: the one-time code becomes a short-lived token (about 1 hour). */
export async function exchangeCodeForToken(code: string) {
  const { appId, appSecret, redirectUri } = instagramConfig();
  const form = new URLSearchParams({
    client_id: appId,
    client_secret: appSecret,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    // Instagram appends this fragment to the code and rejects it if sent back.
    code: code.replace(/#_$/, "")
  });

  const body = await readJson(
    await fetch(`${AUTH_HOST}/oauth/access_token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString()
    })
  );

  const accessToken = String(body.access_token || "");
  if (!accessToken) throw new Error("Instagram did not return an access token.");
  return accessToken;
}

/** Step 2: trade it for a long-lived token, good for about 60 days. */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<InstagramToken> {
  const { appSecret } = instagramConfig();
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: appSecret,
    access_token: shortLivedToken
  });

  const body = await readJson(await fetch(`${GRAPH_HOST}/access_token?${params.toString()}`));
  const accessToken = String(body.access_token || "");
  if (!accessToken) throw new Error("Instagram did not return a long-lived token.");

  const expiresInSeconds = Number(body.expires_in) || 60 * 24 * 60 * 60;
  return { accessToken, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
}

/** Long-lived tokens can be refreshed once they are at least 24 hours old. */
export async function refreshLongLivedToken(accessToken: string): Promise<InstagramToken> {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: accessToken });
  const body = await readJson(await fetch(`${GRAPH_HOST}/refresh_access_token?${params.toString()}`));

  const refreshed = String(body.access_token || accessToken);
  const expiresInSeconds = Number(body.expires_in) || 60 * 24 * 60 * 60;
  return { accessToken: refreshed, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
}

export async function fetchInstagramProfile(accessToken: string): Promise<InstagramProfile> {
  const params = new URLSearchParams({ fields: PROFILE_FIELDS, access_token: accessToken });
  const body = await readJson(await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/me?${params.toString()}`));

  return {
    userId: String(body.user_id || body.id || ""),
    username: String(body.username || ""),
    name: body.name ? String(body.name) : undefined,
    accountType: body.account_type ? String(body.account_type) : undefined,
    followersCount: Number(body.followers_count) || 0,
    followsCount: Number(body.follows_count) || 0,
    mediaCount: Number(body.media_count) || 0,
    profilePictureUrl: body.profile_picture_url ? String(body.profile_picture_url) : undefined,
    biography: body.biography ? String(body.biography) : undefined
  };
}

/** Refreshes when the token is within this window of expiring. */
const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function needsRefresh(expiresAt?: string) {
  if (!expiresAt) return false;
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return false;
  return expiry - Date.now() < REFRESH_WINDOW_MS;
}
