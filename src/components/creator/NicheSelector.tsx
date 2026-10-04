"use client";

import { useState } from "react";
import { AUDIENCE_LANGUAGES, NICHE_TAXONOMY, categoryOf } from "@/lib/niches";
import { Chip, Select } from "@/components/ui";

const MAX_SUB_NICHES = 5;

export default function NicheSelector({ languages, onChange, primaryNiche, subNiches }: {
  languages: string[];
  onChange: (next: { primaryNiche: string; subNiches: string[]; languages: string[] }) => void;
  primaryNiche: string;
  subNiches: string[];
}) {
  const [openCategory, setOpenCategory] = useState(() => categoryOf(primaryNiche) || NICHE_TAXONOMY[0].category);
  const group = NICHE_TAXONOMY.find((item) => item.category === openCategory) || NICHE_TAXONOMY[0];

  const toggleSub = (niche: string) => {
    const next = subNiches.includes(niche) ? subNiches.filter((item) => item !== niche) : [...subNiches, niche].slice(-MAX_SUB_NICHES);
    onChange({ primaryNiche, subNiches: next, languages });
  };
  const toggleLanguage = (language: string) => {
    const next = languages.includes(language) ? languages.filter((item) => item !== language) : [...languages, language];
    onChange({ primaryNiche, subNiches, languages: next });
  };

  return <div className="space-y-4">
    <Select label="Primary niche" onChange={(value) => { onChange({ primaryNiche: value, subNiches: subNiches.filter((item) => item !== value), languages }); setOpenCategory(categoryOf(value) || openCategory); }} value={primaryNiche}>
      <option value="">Select your main niche</option>
      {NICHE_TAXONOMY.map((item) => <optgroup key={item.category} label={item.category}>
        {item.niches.map((niche) => <option key={niche} value={niche}>{niche}</option>)}
      </optgroup>)}
    </Select>

    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-graphite">Sub-niches <span className="text-xs">({subNiches.length}/{MAX_SUB_NICHES})</span></p>
        {subNiches.length ? <button className="text-xs font-semibold text-ai" onClick={() => onChange({ primaryNiche, subNiches: [], languages })} type="button">Clear</button> : null}
      </div>
      <Select label="" onChange={setOpenCategory} value={openCategory}>
        {NICHE_TAXONOMY.map((item) => <option key={item.category} value={item.category}>{item.category}</option>)}
      </Select>
      <div className="mt-3 flex flex-wrap gap-2">
        {group.niches.map((niche) => <Chip active={subNiches.includes(niche)} key={niche} onClick={() => toggleSub(niche)}>{niche}</Chip>)}
      </div>
      {subNiches.length ? <div className="mt-3 flex flex-wrap gap-2 rounded-md border border-line bg-paper p-3">
        <p className="w-full text-xs font-semibold uppercase text-graphite">Selected</p>
        {subNiches.map((niche) => <Chip key={niche} onClick={() => toggleSub(niche)} tone="ai">{niche} &times;</Chip>)}
      </div> : null}
    </div>

    <div>
      <p className="text-sm font-medium text-graphite">Content languages</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {AUDIENCE_LANGUAGES.map((language) => <Chip active={languages.includes(language)} key={language} onClick={() => toggleLanguage(language)}>{language}</Chip>)}
      </div>
    </div>
  </div>;
}
