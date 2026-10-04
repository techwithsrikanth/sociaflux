/**
 * Geographic targeting primitives shared by creator profiles and campaigns.
 *
 * A region is an ISO 3166-1 alpha-2 country code plus optional, free-text state
 * and city. A campaign targets a list of regions; a creator sits in exactly one.
 */

export type Region = {
  /** ISO 3166-1 alpha-2, uppercase. */
  country: string;
  state?: string;
  city?: string;
};

/** Whether a campaign treats its target regions as a hard filter or a ranking signal. */
export type RegionRequirement = "preferred" | "required";

/** How well a creator's location satisfied a campaign's region list. */
export type RegionMatchLevel = "open" | "city" | "state" | "country" | "partial" | "none" | "unknown";

export type CountryOption = { code: string; name: string };

export const COUNTRIES: CountryOption[] = [
  { code: "IN", name: "India" },
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SG", name: "Singapore" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "ES", name: "Spain" },
  { code: "IT", name: "Italy" },
  { code: "NL", name: "Netherlands" },
  { code: "SE", name: "Sweden" },
  { code: "IE", name: "Ireland" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "ZA", name: "South Africa" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "EG", name: "Egypt" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "CN", name: "China" },
  { code: "ID", name: "Indonesia" },
  { code: "MY", name: "Malaysia" },
  { code: "PH", name: "Philippines" },
  { code: "TH", name: "Thailand" },
  { code: "VN", name: "Vietnam" },
  { code: "BD", name: "Bangladesh" },
  { code: "PK", name: "Pakistan" },
  { code: "LK", name: "Sri Lanka" },
  { code: "NP", name: "Nepal" },
  { code: "NZ", name: "New Zealand" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "TR", name: "Turkey" }
];

const COUNTRY_BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));
const COUNTRY_BY_NAME = new Map(COUNTRIES.map((country) => [country.name.toLowerCase(), country]));

/** Common informal spellings that are not the ISO code or our display name. */
const COUNTRY_ALIASES: Record<string, string> = {
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  usa: "US",
  "u.s.": "US",
  "u.s.a.": "US",
  america: "US",
  uae: "AE",
  emirates: "AE",
  "south africa": "ZA",
  korea: "KR"
};

/** Accepts a code ("in", "IN"), a display name ("India") or a common alias ("UK"). */
export function toCountryCode(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  const upper = trimmed.toUpperCase();
  if (COUNTRY_BY_CODE.has(upper)) return upper;
  const byName = COUNTRY_BY_NAME.get(lower);
  if (byName) return byName.code;
  if (COUNTRY_ALIASES[lower]) return COUNTRY_ALIASES[lower];
  return upper.slice(0, 2);
}

export function countryName(code: string) {
  return COUNTRY_BY_CODE.get(code.trim().toUpperCase())?.name || code.trim().toUpperCase();
}

function normalisePart(value?: string) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Builds a canonical region, dropping blank parts. Returns null when no country is given. */
export function createRegion(country: string, state?: string, city?: string): Region | null {
  const code = toCountryCode(country);
  if (!code) return null;
  const region: Region = { country: code };
  if (state?.trim()) region.state = state.trim();
  if (city?.trim()) region.city = city.trim();
  return region;
}

export function regionLabel(region: Region) {
  return [region.city, region.state, countryName(region.country)].filter(Boolean).join(", ");
}

export function regionKey(region: Region) {
  return [region.country.toUpperCase(), normalisePart(region.state), normalisePart(region.city)].join("|");
}

export function sameRegion(left: Region, right: Region) {
  return regionKey(left) === regionKey(right);
}

/**
 * Compares one campaign target against a creator's location.
 *
 * A target is satisfied when every part the campaign specified also matches the
 * creator, so a country-wide target is fully met by a creator anywhere in that
 * country. A creator in the right country but the wrong state/city is "partial".
 */
export function compareRegion(target: Region, location: Region): RegionMatchLevel {
  // Canonicalise here too, so the engine is correct even for callers that pass
  // raw country names rather than codes.
  if (toCountryCode(target.country) !== toCountryCode(location.country)) return "none";

  if (target.city) {
    if (normalisePart(target.city) !== normalisePart(location.city)) return "partial";
    return "city";
  }
  if (target.state) {
    if (normalisePart(target.state) !== normalisePart(location.state)) return "partial";
    return "state";
  }
  return "country";
}

const LEVEL_RANK: Record<RegionMatchLevel, number> = {
  open: 6,
  city: 5,
  state: 4,
  country: 3,
  partial: 2,
  unknown: 1,
  none: 0
};

/** A target is fully satisfied at city, state or country specificity. */
export function isSatisfiedLevel(level: RegionMatchLevel) {
  return level === "open" || level === "city" || level === "state" || level === "country";
}

/** Best level achieved across a campaign's target list. */
export function bestRegionMatch(targets: Region[], location?: Region) {
  if (!targets.length) return { level: "open" as RegionMatchLevel, region: undefined as Region | undefined };
  if (!location) return { level: "unknown" as RegionMatchLevel, region: undefined as Region | undefined };

  let best: { level: RegionMatchLevel; region?: Region } = { level: "none" };
  for (const target of targets) {
    const level = compareRegion(target, location);
    if (LEVEL_RANK[level] > LEVEL_RANK[best.level]) best = { level, region: target };
  }
  return best;
}
