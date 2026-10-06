/**
 * Instagram Business Discovery.
 *
 * Instagram Login (see ./graph.ts) only ever answers for the account that
 * authorised. Business Discovery is the other direction: one professional
 * account we own acts as a lens, and through it we can read the public metrics
 * of *any other* public professional account by username.
 *
 * That is what makes creator lookup work on a server. The request is
 * authenticated as us, so Instagram does not serve it the stripped
 * datacentre-IP page that defeats scraping.
 *
 * Limits worth knowing, all enforced by Meta rather than by us:
 *   - the target must be a public Business or Creator account; personal and
 *     private accounts return an error and we fall back to scraping,
 *   - public metrics only. No email, phone or audience demographics,
 *   - the lens account must be a professional account linked to a Facebook
 *     Page, and the token must come from Facebook Login, not Instagram Login.
 */

import type { ScrapeResult } from "../types";
import { normalizeInstagramHandle } from "../scrapers/instagram";

const GRAPH_HOST = "https://graph.facebook.com";
const GRAPH_VERSION = "v21.0";

/** How many recent posts to average likes and comments over. */
export const MEDIA_SAMPLE_SIZE = 12;

/**
 * Instagram usernames are letters, digits, dots and underscores. Anything else
 * is rejected rather than escaped, because this value is interpolated into a
 * Graph API field expression where quoting rules are undocumented.
 */
const USERNAME_PATTERN = /^[a-z0-9._]{1,30}$/;

export type DiscoveredProfile = {
  username: string;
  name?: string;
  biography?: string;
  website?: string;
  profilePictureUrl?: string;
  followersCount: number;
  followsCount: number;
  mediaCount: number;
  /** Measured from recent posts, not estimated. Absent when no media came back. */
  avgLikes?: number;
  avgComments?: number;
  /** How many posts the averages are based on. */
  sampleSize: number;
};

export function discoveryConfig() {
  return {
    token: process.env.SOCIAFLUX_INSTAGRAM_DISCOVERY_TOKEN?.trim() || "",
    userId: process.env.SOCIAFLUX_INSTAGRAM_DISCOVERY_USER_ID?.trim() || ""
  };
}

export function isDiscoveryConfigured() {
  const { token, userId } = discoveryConfig();
  return Boolean(token && userId);
}

/** `https://instagram.com/cristiano` and `@Cristiano` both become `cristiano`. */
export function discoveryUsername(handleOrUrl: string) {
  const username = normalizeInstagramHandle(handleOrUrl).replace(/^@/, "");
  return USERNAME_PATTERN.test(username) ? username : null;
}

export function discoveryFields(username: string) {
  const media = `media.limit(${MEDIA_SAMPLE_SIZE}){like_count,comments_count,caption,media_type,timestamp,permalink}`;
  const fields = ["username", "name", "biography", "website", "profile_picture_url", "followers_count", "follows_count", "media_count", media].join(",");
  return `business_discovery.username(${username}){${fields}}`;
}

type MediaNode = { like_count?: unknown; comments_count?: unknown };

/** Split out from the fetch so it can be tested without a network call. */
export function parseDiscoveryResponse(body: unknown): DiscoveredProfile | null {
  const discovery = (body as { business_discovery?: Record<string, unknown> } | null)?.business_discovery;
  if (!discovery || typeof discovery !== "object") return null;

  const username = String(discovery.username || "");
  if (!username) return null;

  const media = Array.isArray((discovery.media as { data?: unknown })?.data)
    ? ((discovery.media as { data: MediaNode[] }).data)
    : [];

  // Instagram omits like_count on some posts rather than sending 0, so each
  // average is taken over the posts that actually reported that field.
  const likes = media.map((item) => Number(item.like_count)).filter((value) => Number.isFinite(value));
  const comments = media.map((item) => Number(item.comments_count)).filter((value) => Number.isFinite(value));

  return {
    username,
    name: discovery.name ? String(discovery.name) : undefined,
    biography: discovery.biography ? String(discovery.biography) : undefined,
    website: discovery.website ? String(discovery.website) : undefined,
    profilePictureUrl: discovery.profile_picture_url ? String(discovery.profile_picture_url) : undefined,
    followersCount: Number(discovery.followers_count) || 0,
    followsCount: Number(discovery.follows_count) || 0,
    mediaCount: Number(discovery.media_count) || 0,
    avgLikes: likes.length ? Math.round(likes.reduce((sum, value) => sum + value, 0) / likes.length) : undefined,
    avgComments: comments.length ? Math.round(comments.reduce((sum, value) => sum + value, 0) / comments.length) : undefined,
    sampleSize: media.length
  };
}

/**
 * Returns null for every failure — unconfigured, bad username, private or
 * personal target, rate limit, expired token — because the caller's job is to
 * fall back to scraping, not to distinguish between them. The reason is logged
 * so a deployment can still be diagnosed.
 */
export async function discoverInstagramProfile(handleOrUrl: string): Promise<DiscoveredProfile | null> {
  if (!isDiscoveryConfigured()) return null;

  const username = discoveryUsername(handleOrUrl);
  if (!username) return null;

  const { token, userId } = discoveryConfig();
  const params = new URLSearchParams({ fields: discoveryFields(username), access_token: token });

  try {
    const response = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/${userId}?${params.toString()}`, {
      next: { revalidate: 1800 }
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message = (body as { error?: { message?: string } } | null)?.error?.message || `HTTP ${response.status}`;
      console.warn(`[instagram] business discovery failed for @${username}: ${message}`);
      return null;
    }

    return parseDiscoveryResponse(body);
  } catch (error) {
    console.warn(`[instagram] business discovery error for @${username}: ${error instanceof Error ? error.message : "unknown"}`);
    return null;
  }
}

/**
 * A live health check for diagnostics. Unlike `discoverInstagramProfile`, which
 * swallows every failure so the caller can fall back to scraping, this reports
 * exactly why a lookup failed — a dead or revoked token, a private target, a
 * missing config — so a deployment can be checked from one URL. Returns no
 * secret, only whether each variable is set and what Meta said.
 */
export async function probeBusinessDiscovery(handleOrUrl: string): Promise<{
  configured: boolean;
  tokenSet: boolean;
  userIdSet: boolean;
  ok: boolean;
  followers?: number;
  error?: string;
}> {
  const { token, userId } = discoveryConfig();
  const base = { configured: isDiscoveryConfigured(), tokenSet: Boolean(token), userIdSet: Boolean(userId) };

  if (!base.configured) return { ...base, ok: false, error: "SOCIAFLUX_INSTAGRAM_DISCOVERY_TOKEN and _USER_ID must both be set." };

  const username = discoveryUsername(handleOrUrl);
  if (!username) return { ...base, ok: false, error: `"${handleOrUrl}" is not a valid Instagram handle.` };

  try {
    const params = new URLSearchParams({ fields: discoveryFields(username), access_token: token });
    const response = await fetch(`${GRAPH_HOST}/${GRAPH_VERSION}/${userId}?${params.toString()}`, { cache: "no-store" });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (body as { error?: { message?: string } } | null)?.error?.message || `HTTP ${response.status}`;
      return { ...base, ok: false, error: message };
    }
    const profile = parseDiscoveryResponse(body);
    if (!profile) return { ...base, ok: false, error: "Account is private, personal, or not found." };
    return { ...base, ok: true, followers: profile.followersCount };
  } catch (error) {
    return { ...base, ok: false, error: error instanceof Error ? error.message : "unknown error" };
  }
}

/**
 * Shaped exactly like the scraper's output so the analysis provider needs no
 * knowledge of where the numbers came from. The counts go into `textSample` in
 * the `Label: value` form the provider already parses.
 */
export function discoveryToScrapeResult(profile: DiscoveredProfile): ScrapeResult {
  const handle = `@${profile.username}`;
  const sourceUrl = `https://www.instagram.com/${profile.username}/`;
  const name = profile.name || profile.username;

  const textSample = [
    `Handle: ${handle}`,
    `Name: ${name}`,
    profile.biography ? `Bio: ${profile.biography}` : "",
    `Followers: ${profile.followersCount}`,
    `Following: ${profile.followsCount}`,
    `Posts: ${profile.mediaCount}`,
    profile.avgLikes !== undefined ? `Average likes: ${profile.avgLikes}` : "",
    profile.avgComments !== undefined ? `Average comments: ${profile.avgComments}` : ""
  ]
    .filter(Boolean)
    .join(". ");

  const measured = profile.sampleSize > 0
    ? `Likes and comments are measured over the ${profile.sampleSize} most recent posts.`
    : "Instagram returned no recent posts, so engagement is estimated from follower count.";

  return {
    sourceUrl,
    status: "complete",
    title: `${name} (${handle})`,
    description: profile.biography || "",
    headings: [name, handle, profile.biography || ""].filter(Boolean),
    links: [sourceUrl, ...(profile.website ? [profile.website] : [])],
    images: profile.profilePictureUrl ? [profile.profilePictureUrl] : [],
    socialLinks: [sourceUrl],
    contactHints: profile.website ? [profile.website] : [],
    textSample,
    limitations: [
      "Metrics came from the Instagram Business Discovery API, authorised by this app's own professional account.",
      measured,
      "Public metrics only. Email, phone and audience demographics are not exposed by this API."
    ]
  };
}
