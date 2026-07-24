import * as cheerio from "cheerio";
import type { ScrapeResult } from "../types";

export function normalizeInstagramHandle(input: string) {
  const trimmed = input.trim();
  if (trimmed.startsWith("@")) {
    return trimmed.toLowerCase();
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const firstPath = url.pathname.split("/").filter(Boolean)[0];
    return firstPath ? `@${firstPath.toLowerCase()}` : `@${trimmed.toLowerCase()}`;
  } catch {
    return `@${trimmed.replace(/^@/, "").toLowerCase()}`;
  }
}

export async function scrapeInstagramPublicProfile(input: string): Promise<ScrapeResult> {
  const handle = normalizeInstagramHandle(input);
  const username = handle.replace("@", "");
  const sourceUrl = `https://www.instagram.com/${username}/`;

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CreatorMatchMVP/0.1; public creator profile analysis)",
        "accept-language": "en-US,en;q=0.9"
      },
      next: { revalidate: 1800 }
    });

    if (!response.ok) {
      return limited(handle, sourceUrl, `Instagram returned HTTP ${response.status}.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const ogTitle = decodeHtml(meta($, "property", "og:title") || "");
    const title = decodeHtml($("title").first().text() || ogTitle || handle);
    const ogDescription = decodeHtml(meta($, "property", "og:description") || "");
    const description = decodeHtml(meta($, "name", "description") || ogDescription || "");
    const image = decodeHtml(meta($, "property", "og:image") || "");
    const profile = parseInstagramMeta({ description, handle, ogDescription, ogTitle, title });
    const status = description || ogDescription ? "complete" : "limited";
    const textSample = [
      `Handle: ${profile.handle}`,
      `Name: ${profile.name}`,
      profile.bio ? `Bio: ${profile.bio}` : "",
      profile.followers ? `Followers: ${profile.followers}` : "",
      profile.following ? `Following: ${profile.following}` : "",
      profile.posts ? `Posts: ${profile.posts}` : ""
    ]
      .filter(Boolean)
      .join(". ");

    return {
      sourceUrl,
      status,
      title: profile.name ? `${profile.name} (${profile.handle})` : handle,
      description: profile.bio || description || ogDescription,
      headings: [profile.name, profile.handle, profile.bio].filter(Boolean),
      links: [sourceUrl, ...(profile.website ? [profile.website] : [])],
      images: image ? [image] : [],
      socialLinks: [sourceUrl],
      contactHints: profile.website ? [profile.website] : [],
      textSample,
      limitations:
        status === "complete"
          ? ["Only public Instagram meta data was used. No login, OAuth, private API, or platform bypass was used."]
          : ["Instagram exposed limited public profile data. Creator should confirm bio, metrics, and pricing."]
    };
  } catch (error) {
    return limited(handle, sourceUrl, error instanceof Error ? error.message : "Unknown Instagram retrieval error.");
  }
}

function meta($: cheerio.CheerioAPI, attribute: "name" | "property", value: string) {
  return $(`meta[${attribute}="${value}"]`).attr("content")?.trim();
}

function limited(handle: string, sourceUrl: string, reason: string): ScrapeResult {
  return {
    sourceUrl,
    status: "limited",
    title: handle,
    description: "Limited public Instagram information was available.",
    headings: [handle],
    links: [sourceUrl],
    images: [],
    socialLinks: [sourceUrl],
    contactHints: [],
    textSample: `Public Instagram handle: ${handle}. ${reason}`,
    limitations: [
      reason,
      "No login, OAuth, private API, or platform bypass was used.",
      "Creator should confirm profile fields when Instagram limits public access."
    ]
  };
}

function parseInstagramMeta(input: { description: string; handle: string; ogDescription: string; ogTitle: string; title: string }) {
  const titleMatch = input.ogTitle.match(/^(.+?)\s*\(@([^)]+)\)/) || input.title.match(/^(.+?)\s*\(@([^)]+)\)/);
  const descriptionMatch = input.description.match(/^(.+?)\s+on Instagram:\s*["â€œ](.+?)["â€]?$/i);
  const countsMatch = (input.ogDescription || input.description).match(/([\d.,]+\s*[KMB]?)\s+Followers?,\s*([\d.,]+\s*[KMB]?)\s+Following,\s*([\d.,]+\s*[KMB]?)\s+Posts?/i);
  const name = cleanText(titleMatch?.[1] || stripCountPrefix(descriptionMatch?.[1] || "") || input.handle.replace("@", ""));
  const handle = titleMatch?.[2] ? `@${titleMatch[2].toLowerCase()}` : input.handle;
  const bio = normalizeBio(descriptionMatch?.[2] || "");
  const websiteMatch = bio.match(/https?:\/\/\S+|www\.\S+|[a-z0-9-]+\.[a-z]{2,}(?:\/\S*)?/i);

  return {
    name,
    handle,
    bio,
    followers: countsMatch?.[1],
    following: countsMatch?.[2],
    posts: countsMatch?.[3],
    website: websiteMatch ? normalizeWebsite(websiteMatch[0]) : undefined
  };
}

function stripCountPrefix(value: string) {
  return value.replace(/^[\d.,]+\s*[KMB]?\s+Followers?,\s*[\d.,]+\s*[KMB]?\s+Following,\s*[\d.,]+\s*[KMB]?\s+Posts?\s*-\s*/i, "");
}

function normalizeBio(value: string) {
  const cleaned = cleanText(value).replace(/^"+|"+$/g, "").trim();
  return cleaned.length > 2 ? cleaned : "";
}

function normalizeWebsite(value: string) {
  return value.startsWith("http") ? value : `https://${value}`;
}

function decodeHtml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#064;/g, "@")
    .replace(/&#x2022;/g, "-")
    .replace(/&amp;/g, "&")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)));
}

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

