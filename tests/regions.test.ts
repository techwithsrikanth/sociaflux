import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  bestRegionMatch,
  compareRegion,
  countryName,
  createRegion,
  isSatisfiedLevel,
  regionKey,
  regionLabel,
  sameRegion,
  toCountryCode
} from "../src/lib/regions";

describe("toCountryCode", () => {
  it("passes through a known code", () => {
    assert.equal(toCountryCode("IN"), "IN");
  });

  it("uppercases a lowercase code", () => {
    assert.equal(toCountryCode("in"), "IN");
  });

  it("resolves a display name to its code", () => {
    assert.equal(toCountryCode("India"), "IN");
    assert.equal(toCountryCode("united states"), "US");
  });

  it("returns empty for blank input", () => {
    assert.equal(toCountryCode("   "), "");
  });

  it("resolves common informal aliases", () => {
    assert.equal(toCountryCode("UK"), "GB");
    assert.equal(toCountryCode("usa"), "US");
    assert.equal(toCountryCode("UAE"), "AE");
  });
});

describe("country code canonicalisation in comparison", () => {
  it("matches a target written as a country name against a location stored as a code", () => {
    const target = { country: "United States", city: "San Francisco" };
    const location = { country: "US", state: "California", city: "San Francisco" };

    assert.equal(compareRegion(target, location), "city");
  });

  it("matches an aliased target country", () => {
    assert.equal(compareRegion({ country: "UK" }, { country: "GB", city: "London" }), "country");
  });
});

describe("countryName", () => {
  it("renders a known code as its display name", () => {
    assert.equal(countryName("gb"), "United Kingdom");
  });

  it("falls back to the raw code when unknown", () => {
    assert.equal(countryName("zz"), "ZZ");
  });
});

describe("createRegion", () => {
  it("canonicalises the country and keeps given parts", () => {
    assert.deepEqual(createRegion("India", "Karnataka", "Bangalore"), {
      country: "IN",
      state: "Karnataka",
      city: "Bangalore"
    });
  });

  it("drops blank state and city", () => {
    assert.deepEqual(createRegion("IN", "  ", ""), { country: "IN" });
  });

  it("returns null without a country", () => {
    assert.equal(createRegion(""), null);
  });
});

describe("regionLabel and regionKey", () => {
  it("labels most-specific-first", () => {
    assert.equal(regionLabel(createRegion("IN", "Karnataka", "Bangalore")!), "Bangalore, Karnataka, India");
  });

  it("labels a country-only region", () => {
    assert.equal(regionLabel(createRegion("IN")!), "India");
  });

  it("keys case-insensitively so duplicates collapse", () => {
    assert.equal(regionKey(createRegion("IN", "Karnataka", "bangalore")!), regionKey(createRegion("in", "karnataka", "Bangalore")!));
    assert.equal(sameRegion(createRegion("IN", undefined, "Bangalore")!, createRegion("IN", undefined, "bangalore")!), true);
  });

  it("treats different cities as different regions", () => {
    assert.equal(sameRegion(createRegion("IN", undefined, "Bangalore")!, createRegion("IN", undefined, "Mumbai")!), false);
  });
});

describe("compareRegion", () => {
  const bangalore = createRegion("IN", "Karnataka", "Bangalore")!;

  it("reports country level for a country-wide target", () => {
    assert.equal(compareRegion(createRegion("IN")!, bangalore), "country");
  });

  it("reports state level for a matching state target", () => {
    assert.equal(compareRegion(createRegion("IN", "Karnataka")!, bangalore), "state");
  });

  it("reports city level for a matching city target", () => {
    assert.equal(compareRegion(createRegion("IN", undefined, "Bangalore")!, bangalore), "city");
  });

  it("reports partial for the right country but wrong city", () => {
    assert.equal(compareRegion(createRegion("IN", undefined, "Mumbai")!, bangalore), "partial");
  });

  it("reports partial for the right country but wrong state", () => {
    assert.equal(compareRegion(createRegion("IN", "Maharashtra")!, bangalore), "partial");
  });

  it("reports none for a different country", () => {
    assert.equal(compareRegion(createRegion("US")!, bangalore), "none");
  });

  it("reports partial when the target names a city the creator left blank", () => {
    assert.equal(compareRegion(createRegion("IN", undefined, "Bangalore")!, createRegion("IN")!), "partial");
  });
});

describe("isSatisfiedLevel", () => {
  it("counts open, city, state and country as satisfied", () => {
    for (const level of ["open", "city", "state", "country"] as const) {
      assert.equal(isSatisfiedLevel(level), true, level);
    }
  });

  it("counts partial, unknown and none as unsatisfied", () => {
    for (const level of ["partial", "unknown", "none"] as const) {
      assert.equal(isSatisfiedLevel(level), false, level);
    }
  });
});

describe("bestRegionMatch", () => {
  const bangalore = createRegion("IN", "Karnataka", "Bangalore")!;

  it("is open when there are no targets", () => {
    assert.deepEqual(bestRegionMatch([], bangalore), { level: "open", region: undefined });
  });

  it("is unknown when the creator has no location", () => {
    assert.deepEqual(bestRegionMatch([createRegion("IN")!], undefined), { level: "unknown", region: undefined });
  });

  it("picks the most specific satisfied target", () => {
    const targets = [createRegion("IN")!, createRegion("IN", undefined, "Bangalore")!];
    const best = bestRegionMatch(targets, bangalore);

    assert.equal(best.level, "city");
    assert.equal(best.region?.city, "Bangalore");
  });

  it("prefers a satisfied target over a partial one", () => {
    const targets = [createRegion("IN", undefined, "Mumbai")!, createRegion("IN")!];
    assert.equal(bestRegionMatch(targets, bangalore).level, "country");
  });

  it("returns none when no target shares the country", () => {
    assert.equal(bestRegionMatch([createRegion("US")!, createRegion("GB")!], bangalore).level, "none");
  });
});
