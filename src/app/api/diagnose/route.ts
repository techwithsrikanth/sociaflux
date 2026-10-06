import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { getDb, databaseUrl, isRemoteDatabase } from "@/lib/db/client";
import { probeBusinessDiscovery } from "@/lib/instagram/discovery";

export const dynamic = "force-dynamic";

/**
 * Environment diagnostic.
 *
 * Reports which commit is live, whether the database is reachable, and exactly
 * what Instagram returns to THIS server for a given handle. Instagram serves
 * different content to datacenter IP addresses than to home connections, so the
 * only way to know what a deployment sees is to ask from inside it.
 *
 * Exposes no secrets: only public metadata and whether variables are set.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const handle = (searchParams.get("handle") || "natgeo").replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");

  const build = {
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
    branch: process.env.VERCEL_GIT_COMMIT_REF || "local",
    env: process.env.VERCEL_ENV || "development",
    region: process.env.VERCEL_REGION || "local"
  };

  const config = {
    databaseConfigured: Boolean(process.env.SOCIAFLUX_TURSO_DATABASE_URL),
    tokenConfigured: Boolean(process.env.SOCIAFLUX_TURSO_AUTH_TOKEN),
    usingRemoteDatabase: isRemoteDatabase(),
    databaseHost: isRemoteDatabase() ? new URL(databaseUrl().replace("libsql://", "https://")).host : databaseUrl()
  };

  let database: Record<string, unknown>;
  try {
    const result = await getDb().execute("SELECT count(*) AS n FROM creators");
    database = { reachable: true, creatorRows: Number(result.rows[0]?.n ?? 0) };
  } catch (error) {
    database = { reachable: false, error: error instanceof Error ? error.message : String(error) };
  }

  let instagram: Record<string, unknown>;
  try {
    const url = `https://www.instagram.com/${handle}/`;
    const response = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CreatorMatchMVP/0.1; public creator profile analysis)",
        "accept-language": "en-US,en;q=0.9"
      },
      cache: "no-store"
    });
    const html = await response.text();
    const $ = cheerio.load(html);
    const ogDescription = $('meta[property="og:description"]').attr("content") || "";
    const ogTitle = $('meta[property="og:title"]').attr("content") || "";

    instagram = {
      handle,
      httpStatus: response.status,
      bytes: html.length,
      ogTitle: ogTitle.slice(0, 120),
      // Follower and post counts live in this string when Instagram allows it.
      ogDescription: ogDescription.slice(0, 220),
      hasFollowerCount: /followers/i.test(ogDescription),
      looksLikeLoginWall: /login|log in|sign up/i.test(html.slice(0, 4000)) && !/followers/i.test(ogDescription),
      verdict: /followers/i.test(ogDescription)
        ? "Instagram returned profile metrics to this server."
        : "Instagram withheld profile metrics from this server."
    };
  } catch (error) {
    instagram = { handle, error: error instanceof Error ? error.message : String(error) };
  }

  // Business Discovery is how a hosted server reads creator metrics, so its
  // health is the real answer to "why is everyone showing Unknown". A live
  // probe here catches a dead or revoked token, which scraping cannot.
  const discovery = await probeBusinessDiscovery(handle);

  return NextResponse.json({ build, config, database, discovery, instagram });
}
