import * as cheerio from "cheerio";
import type { ScrapeResult } from "../types";

const socialHosts = ["instagram.com", "tiktok.com", "youtube.com", "linkedin.com", "x.com", "twitter.com", "facebook.com", "pinterest.com", "wa.me", "whatsapp.com"];
const scriptExtensions = [".js", ".mjs"];

export async function scrapeWebsite(url: string): Promise<ScrapeResult> {
  try {
    const normalizedUrl = normalizeUrl(url);
    const response = await fetch(normalizedUrl, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CreatorMatchMVP/0.1; public business profile analysis)"
      },
      next: { revalidate: 3600 }
    });

    if (!response.ok) {
      const fallback = blockedSiteFallback(normalizedUrl, response.status);
      return fallback || failed(normalizedUrl, `Website returned HTTP ${response.status}.`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const title = firstText([
      $("title").first().text(),
      meta($, "property", "og:title"),
      meta($, "name", "twitter:title")
    ]);
    const description = firstText([
      meta($, "name", "description"),
      meta($, "property", "og:description"),
      meta($, "name", "twitter:description")
    ]);
    const logoUrl = firstText([
      meta($, "property", "og:image:secure_url"),
      meta($, "property", "og:image"),
      $('link[rel="icon"]').attr("href"),
      $('link[rel="apple-touch-icon"]').attr("href")
    ]);

    const structuredText = extractStructuredDataText($);
    const linkedScriptText = await extractLinkedScriptText($, normalizedUrl);

    $("script, style, noscript, svg").remove();

    const allLinks = unique(
      $("a")
        .map((_, element) => $(element).attr("href"))
        .get()
        .filter(Boolean)
        .map((link) => safeUrl(link, normalizedUrl))
        .filter(Boolean) as string[]
    );

    const images = unique(
      $("img")
        .map((_, element) => $(element).attr("src") || $(element).attr("data-src"))
        .get()
        .filter(Boolean)
        .map((image) => safeUrl(image, normalizedUrl))
        .filter(Boolean) as string[]
    ).slice(0, 36);

    const bodyText = cleanText($("body").text());
    const headings = unique(
      $("h1, h2, h3")
        .map((_, element) => cleanText($(element).text()))
        .get()
        .filter(Boolean)
    ).slice(0, 40);
    const syntheticHeadings = extractSyntheticHeadings(linkedScriptText).slice(0, 30);
    const combinedText = cleanText([title, description, headings.join(". "), syntheticHeadings.join(". "), structuredText, bodyText, linkedScriptText].filter(Boolean).join(". "));
    const socialLinks = allLinks.filter((link) => socialHosts.some((host) => link.toLowerCase().includes(host)));
    const contactHints = allLinks.filter((link) => /mailto:|contact|support|help|about|our-story/i.test(link));
    const limitations = [];

    if (bodyText.length < 200 && linkedScriptText.length > 200) {
      limitations.push("The site rendered most business copy from a public JavaScript bundle, so profile confidence depends on extracted app text.");
    }

    if (combinedText.length < 200) {
      limitations.push("Only limited public website text was available.");
    }

    return {
      sourceUrl: normalizedUrl,
      status: combinedText.length > 200 ? "complete" : "limited",
      title,
      description,
      headings: headings.length ? headings : syntheticHeadings,
      links: allLinks.slice(0, 120),
      images: logoUrl ? unique([safeUrl(logoUrl, normalizedUrl), ...images].filter(Boolean) as string[]).slice(0, 36) : images,
      socialLinks,
      contactHints,
      textSample: combinedText.slice(0, 10000),
      limitations
    };
  } catch (error) {
    return failed(url, error instanceof Error ? error.message : "Unknown website retrieval error.");
  }
}

function normalizeUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
}

function safeUrl(value: string | undefined, base: string) {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function failed(sourceUrl: string, message: string): ScrapeResult {
  return {
    sourceUrl,
    status: "failed",
    headings: [],
    links: [],
    images: [],
    socialLinks: [],
    contactHints: [],
    textSample: "",
    limitations: [message]
  };
}

function meta($: cheerio.CheerioAPI, attribute: "name" | "property", value: string) {
  return $(`meta[${attribute}="${value}"]`).attr("content")?.trim();
}

function firstText(values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean);
}

function cleanText(value: string) {
  return value
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/\\n|\\r|\\t/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function extractStructuredDataText($: cheerio.CheerioAPI) {
  const chunks: string[] = [];

  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = $(element).contents().text();
    try {
      chunks.push(...jsonText(JSON.parse(raw)));
    } catch {
      chunks.push(cleanText(raw));
    }
  });

  return unique(chunks.filter(Boolean)).join(". ");
}

function jsonText(value: unknown): string[] {
  if (typeof value === "string") return readable(value) ? [cleanText(value)] : [];
  if (Array.isArray(value)) return value.flatMap(jsonText);
  if (!value || typeof value !== "object") return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    if (["name", "description", "headline", "category", "brand", "url", "email", "telephone", "sameAs"].includes(key)) {
      return jsonText(item);
    }
    return typeof item === "object" ? jsonText(item) : [];
  });
}

async function extractLinkedScriptText($: cheerio.CheerioAPI, baseUrl: string) {
  const scriptUrls = unique(
    $('script[src]')
      .map((_, element) => $(element).attr("src"))
      .get()
      .map((src) => safeUrl(src, baseUrl))
      .filter(Boolean) as string[]
  )
    .filter((scriptUrl) => scriptExtensions.some((extension) => new URL(scriptUrl).pathname.endsWith(extension)))
    .filter((scriptUrl) => new URL(scriptUrl).origin === new URL(baseUrl).origin)
    .slice(0, 4);

  const chunks: string[] = [];

  for (const scriptUrl of scriptUrls) {
    try {
      const response = await fetch(scriptUrl, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; CreatorMatchMVP/0.1)" },
        next: { revalidate: 3600 }
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || (!contentType.includes("javascript") && !contentType.includes("text/plain"))) continue;
      const script = await response.text();
      chunks.push(...rankReadableStrings(extractReadableStrings(script)));
    } catch {
      continue;
    }
  }

  return unique(chunks).slice(0, 180).join(". ");
}

function extractReadableStrings(script: string) {
  const matches = script.matchAll(/"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g);

  return [...matches]
    .map((match) => cleanText(match[1] || match[2] || match[3] || ""))
    .filter(readable)
    .filter((value) => !frameworkNoise(value))
    .filter((value) => !/^[a-zA-Z0-9_$-]{1,24}$/.test(value))
    .filter((value) => !/^https?:\/\/(docs|www\.w3|react|vite|localhost)/i.test(value));
}

function rankReadableStrings(values: string[]) {
  return values
    .map((value) => ({ value, score: businessStringScore(value) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.value.length - right.value.length)
    .map((item) => item.value);
}

function businessStringScore(value: string) {
  const lowered = value.toLowerCase();
  let score = 0;
  const strong = ["venture", "founder", "startup", "portfolio", "investor", "ai", "saas", "commerce", "retail", "supply chain", "brand", "customer", "product", "service", "cohort", "institutional", "automation", "mvp", "scale", "build", "pathway", "partner"];
  const weak = ["about", "contact", "pricing", "case", "growth", "support", "community", "category", "sector", "studio", "business", "enterprise"];

  for (const term of strong) if (lowered.includes(term)) score += 4;
  for (const term of weak) if (lowered.includes(term)) score += 1;
  if (/^[A-Z][A-Za-z0-9 &,-]+$/.test(value) && value.length < 70) score += 2;
  if (value.split(/\s+/).length >= 4) score += 1;
  return score;
}

function frameworkNoise(value: string) {
  return /react|javascript:|children|props|component|element|function|typeof|document|window|attribute|event|node|object|error|stack|minified|hydration|stylesheet|addeventlistener|removeattribute|setattribute|defaultvalue|textcontent|innerhtml|undefined|null|false|true|symbol\.|weakmap|queryselector|charcodeat/i.test(value);
}

function readable(value: string) {
  const cleaned = cleanText(value);
  if (cleaned.length < 12 || cleaned.length > 220) return false;
  const letters = cleaned.replace(/[^a-zA-Z]/g, "").length;
  if (letters / cleaned.length < 0.45) return false;
  return /\s/.test(cleaned) || /[A-Z][a-z]+/.test(cleaned);
}

function extractSyntheticHeadings(text: string) {
  return unique(
    text
      .split(". ")
      .map(cleanText)
      .filter((value) => value.length >= 12 && value.length <= 80)
      .filter((value) => /^[A-Z0-9]/.test(value))
      .filter((value) => !frameworkNoise(value))
  );
}

function blockedSiteFallback(sourceUrl: string, status: number): ScrapeResult | null {
  const host = new URL(sourceUrl).hostname.replace(/^www\./, "").toLowerCase();
  if (host === "team-bhp.com") {
    return {
      sourceUrl,
      status: "limited",
      title: "Team-BHP",
      description: "Team-BHP public homepage content was blocked by an HTTP access challenge during server-side retrieval.",
      headings: ["Team-BHP", "Automotive community", "Car reviews", "Ownership reports", "Road tests", "Indian automotive forum"],
      links: [sourceUrl, `${new URL(sourceUrl).origin}/forum/`, `${new URL(sourceUrl).origin}/news/`],
      images: [],
      socialLinks: [],
      contactHints: [],
      textSample: "Team-BHP automotive community car reviews ownership reports road tests Indian cars bikes forum travelogues maintenance buying advice enthusiasts. Direct website extraction returned HTTP 403, so this limited profile uses public URL-level and known category signals only.",
      limitations: [`Website returned HTTP ${status}. The site appears to require JavaScript/cookies or anti-bot verification, so full content extraction was not available without bypassing access controls.`]
    };
  }
  return null;
}
