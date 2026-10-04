"use client";

import { MapPin, Plus } from "lucide-react";
import { useState } from "react";
import { Chip, GhostButton, Input, Select } from "@/components/ui";
import { COUNTRIES, createRegion, regionKey, regionLabel } from "@/lib/regions";
import type { Region } from "@/lib/regions";

/** Multi-region picker for campaign targeting. */
export function RegionPicker({ onChange, regions }: { onChange: (regions: Region[]) => void; regions: Region[] }) {
  const [country, setCountry] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState("");

  function add() {
    const region = createRegion(country, state, city);
    if (!region) return setError("Pick a country first.");
    if (regions.some((item) => regionKey(item) === regionKey(region))) return setError("That region is already targeted.");
    onChange([...regions, region]);
    setState("");
    setCity("");
    setError("");
  }

  return <div className="space-y-3">
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
      <Select label="Country" onChange={(value) => { setCountry(value); setError(""); }} value={country}>
        <option value="">Select a country</option>
        {COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
      </Select>
      <Input label="State / region (optional)" onChange={setState} placeholder="Karnataka" value={state} />
      <Input label="City (optional)" onChange={setCity} placeholder="Bangalore" value={city} />
      <GhostButton onClick={add}><Plus size={15} /> Add</GhostButton>
    </div>

    {error ? <p className="text-sm text-coral">{error}</p> : null}

    {regions.length ? <div className="flex flex-wrap gap-2 rounded-md border border-line bg-paper p-3">
      <p className="w-full text-xs font-semibold uppercase text-graphite">Target regions ({regions.length})</p>
      {regions.map((region) => <Chip key={regionKey(region)} onClick={() => onChange(regions.filter((item) => regionKey(item) !== regionKey(region)))} tone="ai">{regionLabel(region)} &times;</Chip>)}
    </div> : <p className="text-xs text-graphite">No regions added &mdash; the campaign is open worldwide.</p>}
  </div>;
}

/** Single-location fields for a creator's own public location. */
export function LocationFields({ location, onChange }: { location?: Region; onChange: (region?: Region) => void }) {
  const update = (country: string, state?: string, city?: string) => onChange(createRegion(country, state, city) || undefined);

  return <div className="grid gap-3 md:grid-cols-3">
    <Select label="Country" onChange={(value) => update(value, location?.state, location?.city)} value={location?.country || ""}>
      <option value="">Not stated</option>
      {COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
    </Select>
    <Input label="State / region" onChange={(value) => update(location?.country || "", value, location?.city)} placeholder="Karnataka" value={location?.state || ""} />
    <Input label="City" onChange={(value) => update(location?.country || "", location?.state, value)} placeholder="Bangalore" value={location?.city || ""} />
  </div>;
}

export function RegionChips({ regions }: { regions: Region[] }) {
  if (!regions.length) return <Chip>Worldwide</Chip>;
  return <>{regions.slice(0, 3).map((region) => <Chip key={regionKey(region)}><MapPin className="mr-1 inline" size={11} />{regionLabel(region)}</Chip>)}</>;
}
