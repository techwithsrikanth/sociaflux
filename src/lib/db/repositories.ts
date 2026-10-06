/**
 * Data access for the marketplace.
 *
 * Every function returns the same domain types the UI already uses, so callers
 * never deal with rows. Filterable fields are read from real columns; the rest
 * comes out of the JSON payload.
 */

import { getDb, nullableText, parseJson, toBool, toInt, toText } from "./client";
import { normaliseCampaign } from "../marketplace";
import { normaliseHandle } from "../marketplace";
import type { Application, ApplicationStatus, Campaign } from "../marketplace";
import type { BusinessProfile, CreatorProfile } from "../types";
import type { Row } from "@libsql/client";

/* ------------------------------------------------------------------ creators */

function rowToCreator(row: Row): CreatorProfile {
  const profile = parseJson<CreatorProfile | null>(row.profile, null);
  if (!profile) throw new Error(`Creator ${String(row.handle)} has an unreadable profile payload.`);

  // Columns win over the JSON copy: they are what queries filtered on.
  return {
    ...profile,
    handle: toText(row.handle, profile.handle),
    name: toText(row.name, profile.name),
    primaryNiche: toText(row.primary_niche, profile.primaryNiche),
    subNiches: parseJson<string[]>(row.sub_niches, profile.subNiches || []),
    contentLanguages: parseJson<string[]>(row.content_languages, profile.contentLanguages || []),
    openForBarter: toBool(row.open_for_barter),
    verified: toBool(row.verified),
    instagram: row.instagram_user_id
      ? { userId: toText(row.instagram_user_id), connectedAt: nullableText(row.instagram_connected_at) || undefined }
      : undefined,
    publicFollowerCount: toInt(row.followers, profile.publicFollowerCount || 0),
    location: row.country
      ? { country: toText(row.country), state: nullableText(row.state) || undefined, city: nullableText(row.city) || undefined }
      : profile.location
  };
}

export async function listCreators(): Promise<CreatorProfile[]> {
  const result = await getDb().execute("SELECT * FROM creators ORDER BY updated_at DESC");
  return result.rows.map(rowToCreator);
}

export async function getCreator(handle: string): Promise<CreatorProfile | null> {
  const result = await getDb().execute({
    sql: "SELECT * FROM creators WHERE handle = ?",
    args: [normaliseHandle(handle)]
  });
  return result.rows.length ? rowToCreator(result.rows[0]) : null;
}

export async function saveCreator(profile: CreatorProfile): Promise<CreatorProfile> {
  const handle = normaliseHandle(profile.handle);
  if (!handle) throw new Error("A creator needs a handle.");

  const stored: CreatorProfile = { ...profile, handle };
  await getDb().execute({
    sql: `INSERT INTO creators (
            handle, name, email, primary_niche, sub_niches, content_languages,
            country, state, city, open_for_barter, followers, package_price, reel_count, profile
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (handle) DO UPDATE SET
            name = excluded.name,
            email = excluded.email,
            primary_niche = excluded.primary_niche,
            sub_niches = excluded.sub_niches,
            content_languages = excluded.content_languages,
            country = excluded.country,
            state = excluded.state,
            city = excluded.city,
            open_for_barter = excluded.open_for_barter,
            followers = excluded.followers,
            package_price = excluded.package_price,
            reel_count = excluded.reel_count,
            profile = excluded.profile,
            updated_at = datetime('now')`,
    args: [
      handle,
      stored.name || handle,
      stored.contact?.email || null,
      stored.primaryNiche || null,
      JSON.stringify(stored.subNiches || []),
      JSON.stringify(stored.contentLanguages || []),
      stored.location?.country || null,
      stored.location?.state || null,
      stored.location?.city || null,
      stored.openForBarter ? 1 : 0,
      stored.publicFollowerCount || 0,
      stored.pricing?.packagePrice || 0,
      stored.reels?.length || 0,
      JSON.stringify(stored)
    ]
  });
  return stored;
}

export type CreatorSearch = {
  niche?: string;
  country?: string;
  state?: string;
  city?: string;
  openForBarter?: boolean;
  minFollowers?: number;
  maxPrice?: number;
};

/** Column-level filtering; richer tag matching stays in the matching engine. */
export async function searchCreators(filters: CreatorSearch): Promise<CreatorProfile[]> {
  const where: string[] = [];
  const args: Array<string | number> = [];

  if (filters.niche) {
    where.push("(lower(primary_niche) LIKE ? OR lower(sub_niches) LIKE ?)");
    args.push(`%${filters.niche.toLowerCase()}%`, `%${filters.niche.toLowerCase()}%`);
  }
  if (filters.country) {
    where.push("country = ?");
    args.push(filters.country);
  }
  if (filters.state) {
    where.push("lower(state) = ?");
    args.push(filters.state.toLowerCase());
  }
  if (filters.city) {
    where.push("lower(city) = ?");
    args.push(filters.city.toLowerCase());
  }
  if (filters.openForBarter) where.push("open_for_barter = 1");
  if (filters.minFollowers) {
    where.push("followers >= ?");
    args.push(filters.minFollowers);
  }
  if (filters.maxPrice) {
    where.push("(package_price = 0 OR package_price <= ?)");
    args.push(filters.maxPrice);
  }

  const result = await getDb().execute({
    sql: `SELECT * FROM creators ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY followers DESC`,
    args
  });
  return result.rows.map(rowToCreator);
}

/* ----------------------------------------------------------------- campaigns */

function rowToCampaign(row: Row): Campaign {
  const data = parseJson<Partial<Campaign>>(row.data, {});
  return normaliseCampaign({
    ...data,
    id: toText(row.id, data.id),
    name: toText(row.name, data.name || "Campaign"),
    brandName: nullableText(row.brand_name) || data.brandName,
    budget: toInt(row.budget, data.budget || 0),
    minFollowers: toInt(row.min_followers, data.minFollowers || 0),
    status: (toText(row.status, "open") as Campaign["status"]) || "open",
    postedAt: nullableText(row.posted_at) || data.postedAt
  });
}

export async function listCampaigns(options: { brandId?: string; status?: string } = {}): Promise<Campaign[]> {
  const where: string[] = [];
  const args: string[] = [];
  if (options.brandId) {
    where.push("brand_id = ?");
    args.push(options.brandId);
  }
  if (options.status) {
    where.push("status = ?");
    args.push(options.status);
  }

  const result = await getDb().execute({
    sql: `SELECT * FROM campaigns ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY posted_at DESC`,
    args
  });
  return result.rows.map(rowToCampaign);
}

export async function getCampaign(id: string): Promise<Campaign | null> {
  const result = await getDb().execute({ sql: "SELECT * FROM campaigns WHERE id = ?", args: [id] });
  return result.rows.length ? rowToCampaign(result.rows[0]) : null;
}

export async function saveCampaign(input: Partial<Campaign> & { name: string }, brandId?: string): Promise<Campaign> {
  const campaign = normaliseCampaign(input);

  // campaigns.brand_id is a foreign key, and a brand often posts before its
  // full profile has been saved, so make sure a row exists first.
  if (brandId) {
    await getDb().execute({
      sql: `INSERT INTO brands (id, name, profile) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING`,
      args: [brandId, campaign.brandName || brandId, JSON.stringify({ businessName: campaign.brandName || brandId })]
    });
  }

  await getDb().execute({
    sql: `INSERT INTO campaigns (
            id, brand_id, brand_name, name, objective, status, budget,
            min_followers, barter_policy, region_requirement, posted_at, data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            brand_id = excluded.brand_id,
            brand_name = excluded.brand_name,
            name = excluded.name,
            objective = excluded.objective,
            status = excluded.status,
            budget = excluded.budget,
            min_followers = excluded.min_followers,
            barter_policy = excluded.barter_policy,
            region_requirement = excluded.region_requirement,
            posted_at = excluded.posted_at,
            data = excluded.data,
            updated_at = datetime('now')`,
    args: [
      campaign.id,
      brandId || null,
      campaign.brandName || null,
      campaign.name,
      campaign.objective || "awareness",
      campaign.status || "open",
      campaign.budget || 0,
      campaign.minFollowers || 0,
      campaign.barterPolicy || "paid",
      campaign.regionRequirement || "preferred",
      campaign.postedAt || new Date().toISOString(),
      JSON.stringify(campaign)
    ]
  });
  return campaign;
}

export async function deleteCampaign(id: string) {
  await getDb().batch([
    { sql: "DELETE FROM applications WHERE campaign_id = ?", args: [id] },
    { sql: "DELETE FROM campaigns WHERE id = ?", args: [id] }
  ]);
}

/* -------------------------------------------------------------- applications */

function rowToApplication(row: Row): Application {
  return {
    id: toText(row.id),
    campaignId: toText(row.campaign_id),
    campaignName: toText(row.campaign_name),
    creatorHandle: toText(row.creator_handle),
    pitch: toText(row.pitch),
    quotedPrice: toInt(row.quoted_price),
    openToBarter: toBool(row.open_to_barter),
    status: (toText(row.status, "applied") as ApplicationStatus) || "applied",
    appliedAt: toText(row.applied_at),
    decidedAt: nullableText(row.decided_at) || undefined,
    brandNote: nullableText(row.brand_note) || undefined
  };
}

export async function listApplications(options: { campaignId?: string; creatorHandle?: string } = {}): Promise<Application[]> {
  const where: string[] = [];
  const args: string[] = [];
  if (options.campaignId) {
    where.push("campaign_id = ?");
    args.push(options.campaignId);
  }
  if (options.creatorHandle) {
    where.push("creator_handle = ?");
    args.push(normaliseHandle(options.creatorHandle));
  }

  const result = await getDb().execute({
    sql: `SELECT * FROM applications ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY applied_at DESC`,
    args
  });
  return result.rows.map(rowToApplication);
}

/**
 * Applying twice to the same campaign replaces the earlier application.
 *
 * The upsert keeps the existing row's id on conflict, so the stored row is
 * returned rather than the submitted object — otherwise the caller would hold
 * an id that does not exist and every later update would 404.
 */
export async function saveApplication(application: Application): Promise<Application> {
  const stored: Application = { ...application, creatorHandle: normaliseHandle(application.creatorHandle) };
  const result = await getDb().execute({
    sql: `INSERT INTO applications (
            id, campaign_id, campaign_name, creator_handle, pitch,
            quoted_price, open_to_barter, status, applied_at, decided_at, brand_note
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT (campaign_id, creator_handle) DO UPDATE SET
            pitch = excluded.pitch,
            quoted_price = excluded.quoted_price,
            open_to_barter = excluded.open_to_barter,
            status = excluded.status,
            applied_at = excluded.applied_at,
            decided_at = excluded.decided_at,
            brand_note = excluded.brand_note,
            updated_at = datetime('now')
          RETURNING *`,
    args: [
      stored.id,
      stored.campaignId,
      stored.campaignName,
      stored.creatorHandle,
      stored.pitch,
      stored.quotedPrice,
      stored.openToBarter ? 1 : 0,
      stored.status,
      stored.appliedAt,
      stored.decidedAt || null,
      stored.brandNote || null
    ]
  });
  return result.rows.length ? rowToApplication(result.rows[0]) : stored;
}

/**
 * Brand-initiated outreach. Creates an application for a creator the brand
 * found through discovery, but only if none exists for that (campaign, creator)
 * pair — so reaching out never overwrites a real application the creator made,
 * nor downgrades an approval. Returns the existing row untouched when there is
 * one, so the caller can tell the brand they already have a thread.
 */
export async function inviteApplication(input: {
  id: string;
  campaignId: string;
  campaignName: string;
  creatorHandle: string;
  brandNote?: string;
}): Promise<{ application: Application; created: boolean }> {
  const handle = normaliseHandle(input.creatorHandle);
  const existing = await getDb().execute({
    sql: "SELECT * FROM applications WHERE campaign_id = ? AND creator_handle = ?",
    args: [input.campaignId, handle]
  });
  if (existing.rows.length) return { application: rowToApplication(existing.rows[0]), created: false };

  const application: Application = {
    id: input.id,
    campaignId: input.campaignId,
    campaignName: input.campaignName,
    creatorHandle: handle,
    pitch: "",
    quotedPrice: 0,
    openToBarter: false,
    status: "shortlisted",
    appliedAt: new Date().toISOString(),
    brandNote: input.brandNote || "The brand reached out to you about this campaign."
  };
  return { application: await saveApplication(application), created: true };
}

export async function setApplicationStatus(id: string, status: ApplicationStatus, brandNote?: string): Promise<Application | null> {
  await getDb().execute({
    sql: `UPDATE applications
          SET status = ?, decided_at = ?, brand_note = COALESCE(?, brand_note), updated_at = datetime('now')
          WHERE id = ?`,
    args: [status, new Date().toISOString(), brandNote || null, id]
  });
  const result = await getDb().execute({ sql: "SELECT * FROM applications WHERE id = ?", args: [id] });
  return result.rows.length ? rowToApplication(result.rows[0]) : null;
}

export async function deleteApplication(id: string) {
  await getDb().execute({ sql: "DELETE FROM applications WHERE id = ?", args: [id] });
}

/* -------------------------------------------------------------------- brands */

export async function saveBrand(profile: BusinessProfile, id: string): Promise<string> {
  await getDb().execute({
    sql: `INSERT INTO brands (id, name, website, industry, category, profile)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT (id) DO UPDATE SET
            name = excluded.name,
            website = excluded.website,
            industry = excluded.industry,
            category = excluded.category,
            profile = excluded.profile,
            updated_at = datetime('now')`,
    args: [id, profile.businessName, profile.website || null, profile.industry || null, profile.category || null, JSON.stringify(profile)]
  });
  return id;
}

export async function getBrand(id: string): Promise<BusinessProfile | null> {
  const result = await getDb().execute({ sql: "SELECT profile FROM brands WHERE id = ?", args: [id] });
  return result.rows.length ? parseJson<BusinessProfile | null>(result.rows[0].profile, null) : null;
}

/* -------------------------------------------- instagram connection */

export type InstagramConnection = {
  userId: string;
  accessToken: string;
  expiresAt: string;
};

/**
 * Stores a creator's Instagram connection and marks them verified.
 *
 * The token lives in its own column rather than inside the profile JSON, so it
 * is never serialised into an API response.
 */
export async function saveInstagramConnection(handle: string, connection: InstagramConnection) {
  await getDb().execute({
    sql: `UPDATE creators
          SET instagram_user_id = ?,
              instagram_token = ?,
              instagram_token_expires_at = ?,
              instagram_connected_at = COALESCE(instagram_connected_at, datetime('now')),
              verified = 1,
              updated_at = datetime('now')
          WHERE handle = ?`,
    args: [connection.userId, connection.accessToken, connection.expiresAt, normaliseHandle(handle)]
  });
}

/** Server-only. Never expose the token through an API route. */
export async function getInstagramToken(handle: string) {
  const result = await getDb().execute({
    sql: "SELECT instagram_token, instagram_token_expires_at FROM creators WHERE handle = ?",
    args: [normaliseHandle(handle)]
  });
  if (!result.rows.length) return null;
  const token = nullableText(result.rows[0].instagram_token);
  if (!token) return null;
  return { accessToken: token, expiresAt: nullableText(result.rows[0].instagram_token_expires_at) || undefined };
}

export async function disconnectInstagram(handle: string) {
  await getDb().execute({
    sql: `UPDATE creators
          SET instagram_user_id = NULL, instagram_token = NULL, instagram_token_expires_at = NULL,
              instagram_connected_at = NULL, verified = 0, updated_at = datetime('now')
          WHERE handle = ?`,
    args: [normaliseHandle(handle)]
  });
}
