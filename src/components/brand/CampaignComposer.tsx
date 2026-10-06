"use client";

import { Megaphone, Target } from "lucide-react";
import { useState } from "react";
import { RegionPicker } from "@/components/RegionFields";
import { BriefAssetEditor } from "@/components/brand/BriefAssets";
import { Chip, Input, Panel, PrimaryButton, Select, TextArea } from "@/components/ui";
import { FOLLOWER_TIERS, NICHE_TAXONOMY, categoryOf } from "@/lib/niches";
import { OBJECTIVE_LABEL } from "@/lib/campaign-metrics";
import { BARTER_POLICY_LABEL, OBJECTIVES, compactNumber } from "@/lib/marketplace";
import type { BarterPolicy, BriefAsset, Campaign, CampaignObjective, CampaignTargets } from "@/lib/marketplace";
import type { Region, RegionRequirement } from "@/lib/regions";

const barterHint: Record<BarterPolicy, string> = {
  paid: "Cash only. Barter willingness is ignored when ranking applicants.",
  flexible: "Cash or product exchange. Creators open to barter rank higher.",
  barter_only: "Product or service exchange only. Creators not open to barter are filtered out."
};

const objectiveHint: Record<CampaignObjective, string> = {
  awareness: "Maximise how many people see it. Projections favour reach over clicks.",
  engagement: "Drive comments, saves and shares rather than raw reach.",
  traffic: "Send people to a page. Click-through is projected higher.",
  conversions: "Drive purchases or sign-ups. Conversion rate is projected highest.",
  ugc: "Collect content you can reuse. Reach matters least here."
};

const TARGET_FIELDS: Array<{ key: keyof CampaignTargets; label: string; placeholder: string }> = [
  { key: "reach", label: "Target reach (people)", placeholder: "250000" },
  { key: "impressions", label: "Target impressions", placeholder: "400000" },
  { key: "engagementRate", label: "Target engagement rate (%)", placeholder: "4.5" },
  { key: "clicks", label: "Target clicks", placeholder: "5000" },
  { key: "conversions", label: "Target conversions", placeholder: "250" },
  { key: "cpmTarget", label: "Max CPM ($ per 1k reach)", placeholder: "12" },
  { key: "cpaTarget", label: "Max cost per conversion ($)", placeholder: "40" }
];

const DELIVERABLES = ["1 reel", "2 reels", "3 reels", "Carousel post", "Story set", "UGC ad footage", "YouTube integration", "Livestream", "Product review"];

export default function CampaignComposer({ campaign, onLaunch, personaText, questionsSlot, setCampaign, targetSelector }: {
  campaign: Campaign;
  onLaunch: () => void;
  personaText: string;
  questionsSlot: React.ReactNode;
  setCampaign: (next: Campaign) => void;
  targetSelector: React.ReactNode;
}) {
  // Derive the opening category from a niche the brand already picked, so
  // returning to this tab does not snap the dropdown back to the first category
  // and lose where they were.
  const [nicheCategory, setNicheCategory] = useState(() => categoryOf((campaign.targetNiches || [])[0]) || NICHE_TAXONOMY[0].category);
  const group = NICHE_TAXONOMY.find((item) => item.category === nicheCategory) || NICHE_TAXONOMY[0];
  const targetNiches = campaign.targetNiches || [];
  const deliverables = campaign.deliverables || [];

  const setTarget = (key: keyof CampaignTargets, value: string) => {
    const next: CampaignTargets = { ...campaign.targets };
    const parsed = Number(value);
    if (!value.trim() || Number.isNaN(parsed) || parsed <= 0) delete next[key];
    else next[key] = parsed;
    setCampaign({ ...campaign, targets: next });
  };
  const setList = (key: "mustInclude" | "mustAvoid" | "hashtags" | "mentions", value: string) => {
    setCampaign({ ...campaign, [key]: value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean) });
  };
  const toggle = (key: "targetNiches" | "deliverables", value: string) => {
    const current = campaign[key] || [];
    setCampaign({ ...campaign, [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
  };

  return <div className="space-y-5">
    <Panel title="Step 4: Post a campaign">
      <p className="text-sm leading-6 text-graphite">Posting a campaign publishes it to the creator campaign board. Creators who match your targeting see it, apply with a pitch and a quote, and you review them under Applicants.</p>
      <div className="mt-4 mb-4">{targetSelector}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input label="Campaign name" onChange={(value) => setCampaign({ ...campaign, name: value })} value={campaign.name} />
        <Input label="Goal" onChange={(value) => setCampaign({ ...campaign, goal: value })} value={campaign.goal} />
        <Input label="Target audience" onChange={(value) => setCampaign({ ...campaign, audience: value })} value={campaign.audience} />
        <Input label="Preferred creator type" onChange={(value) => setCampaign({ ...campaign, creatorType: value })} value={campaign.creatorType} />
        <Input label="Budget (USD)" onChange={(value) => setCampaign({ ...campaign, budget: Number(value) })} type="number" value={String(campaign.budget)} />
        <Input label="Duration" onChange={(value) => setCampaign({ ...campaign, duration: value })} value={campaign.duration} />
        <Select label="Minimum audience size" onChange={(value) => setCampaign({ ...campaign, minFollowers: Number(value) })} value={String(campaign.minFollowers || 0)}>
          {FOLLOWER_TIERS.map((tier) => <option key={tier.label} value={tier.min}>{tier.label}</option>)}
        </Select>
        <Select label="Compensation" onChange={(value) => setCampaign({ ...campaign, barterPolicy: value as BarterPolicy })} value={campaign.barterPolicy || "paid"}>
          {(Object.keys(BARTER_POLICY_LABEL) as BarterPolicy[]).map((policy) => <option key={policy} value={policy}>{BARTER_POLICY_LABEL[policy]}</option>)}
        </Select>
      </div>
      <p className="mt-3 text-xs text-graphite">{barterHint[campaign.barterPolicy || "paid"]}</p>
    </Panel>

    <Panel title="Objective and targets">
      <p className="text-sm leading-6 text-graphite">What should this campaign deliver? The objective changes how reach, clicks and conversions are projected, and the targets are tracked against your chosen creators on the Applicants page.</p>
      <div className="mt-4 max-w-sm">
        <Select label="Campaign objective" onChange={(value) => setCampaign({ ...campaign, objective: value as CampaignObjective })} value={campaign.objective || "awareness"}>
          {OBJECTIVES.map((objective) => <option key={objective} value={objective}>{OBJECTIVE_LABEL[objective]}</option>)}
        </Select>
      </div>
      <p className="mt-2 text-xs text-graphite">{objectiveHint[campaign.objective || "awareness"]}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {TARGET_FIELDS.map((field) => <Input key={field.key} label={field.label} onChange={(value) => setTarget(field.key, value)} placeholder={field.placeholder} type="number" value={campaign.targets?.[field.key] ? String(campaign.targets[field.key]) : ""} />)}
      </div>
      <p className="mt-3 text-xs text-graphite">Leave a target blank to skip tracking it.</p>
    </Panel>

    <Panel title="Where creators should be based">
      <p className="text-sm leading-6 text-graphite">Add the countries, states or cities this campaign runs in. A country-wide target is met by any creator in that country; add a city to narrow it.</p>
      <div className="mt-4"><RegionPicker onChange={(regions: Region[]) => setCampaign({ ...campaign, targetRegions: regions })} regions={campaign.targetRegions || []} /></div>
      <Select label="Region rule" onChange={(value) => setCampaign({ ...campaign, regionRequirement: value as RegionRequirement })} value={campaign.regionRequirement || "preferred"}>
        <option value="preferred">Preferred &mdash; score creators on region fit</option>
        <option value="required">Required &mdash; only accept creators in these regions</option>
      </Select>
    </Panel>

    <Panel title="Who should apply">
      <p className="text-sm leading-6 text-graphite">Pick the niches this campaign is open to. Creators can filter the board by these, and applicants outside them are flagged when you review.</p>
      <div className="mt-4 max-w-xs">
        <Select label="Browse niches by category" onChange={setNicheCategory} value={nicheCategory}>
          {NICHE_TAXONOMY.map((item) => <option key={item.category} value={item.category}>{item.category}</option>)}
        </Select>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {group.niches.map((niche) => <Chip active={targetNiches.includes(niche)} key={niche} onClick={() => toggle("targetNiches", niche)}>{niche}</Chip>)}
      </div>
      {targetNiches.length ? <div className="mt-4 flex flex-wrap gap-2 rounded-md border border-line bg-paper p-3">
        <p className="w-full text-xs font-semibold uppercase text-graphite">Open to ({targetNiches.length})</p>
        {targetNiches.map((niche) => <Chip key={niche} onClick={() => toggle("targetNiches", niche)} tone="ai">{niche} &times;</Chip>)}
      </div> : <p className="mt-4 text-xs text-graphite">No niches selected &mdash; the campaign will be open to every creator.</p>}

      <p className="mt-6 text-sm font-medium text-graphite">Deliverables</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DELIVERABLES.map((item) => <Chip active={deliverables.includes(item)} key={item} onClick={() => toggle("deliverables", item)}>{item}</Chip>)}
      </div>

    </Panel>

    <Panel title="Reference material">
      <p className="text-sm leading-6 text-graphite">Attach the images, sample videos and brief documents that show creators how the ad should look and sound. Applicants see these on the campaign before they apply.</p>
      <div className="mt-4"><BriefAssetEditor assets={campaign.briefAssets || []} onChange={(assets: BriefAsset[]) => setCampaign({ ...campaign, briefAssets: assets })} /></div>
    </Panel>

    <Panel title="Content direction">
      <div className="space-y-4">
        <TextArea label="How the content should go" onChange={(value) => setCampaign({ ...campaign, contentGuidelines: value })} placeholder="Open on the product in use, keep it unscripted, show the result by the 15 second mark." rows={4} value={campaign.contentGuidelines || ""} />
        <TextArea label="Who should apply, in your words" onChange={(value) => setCampaign({ ...campaign, creatorRequirements: value })} placeholder="Creators who actually use the product and can film in natural light." rows={3} value={campaign.creatorRequirements || ""} />
        <div className="grid gap-3 md:grid-cols-2">
          <TextArea label="Must include (comma separated)" onChange={(value) => setList("mustInclude", value)} placeholder="Product name on screen, discount code" rows={2} value={(campaign.mustInclude || []).join(", ")} />
          <TextArea label="Must avoid (comma separated)" onChange={(value) => setList("mustAvoid", value)} placeholder="Medical claims, competitor names" rows={2} value={(campaign.mustAvoid || []).join(", ")} />
          <Input label="Hashtags (comma separated)" onChange={(value) => setList("hashtags", value)} placeholder="#ad, #brandpartner" value={(campaign.hashtags || []).join(", ")} />
          <Input label="Mentions (comma separated)" onChange={(value) => setList("mentions", value)} placeholder="@yourbrand" value={(campaign.mentions || []).join(", ")} />
          <Input label="Usage rights" onChange={(value) => setCampaign({ ...campaign, usageRights: value })} placeholder="Organic only, 3 months paid usage" value={campaign.usageRights || ""} />
          <Input label="Submission deadline" onChange={(value) => setCampaign({ ...campaign, submissionDeadline: value })} type="date" value={campaign.submissionDeadline || ""} />
        </div>
      </div>
    </Panel>

    <Panel title="Campaign brief">
      {questionsSlot}
      <div className="mt-5 rounded-md border border-line bg-paper p-4">
        <p className="text-sm font-semibold">Campaign persona</p>
        <p className="mt-2 text-sm leading-6 text-graphite">{personaText}</p>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onLaunch}><Megaphone size={16} /> Post campaign to creators</PrimaryButton>
        <p className="text-xs text-graphite">
          Visible to {targetNiches.length ? `${targetNiches.length} niche${targetNiches.length > 1 ? "s" : ""}` : "all niches"}
          {campaign.minFollowers ? `, ${compactNumber(campaign.minFollowers)}+ followers` : ""}
          {campaign.targetRegions?.length ? `, ${campaign.targetRegions.length} region${campaign.targetRegions.length > 1 ? "s" : ""} (${campaign.regionRequirement === "required" ? "required" : "preferred"})` : ", worldwide"}
          {campaign.barterPolicy && campaign.barterPolicy !== "paid" ? `, ${BARTER_POLICY_LABEL[campaign.barterPolicy].toLowerCase()}` : ""}
        </p>
        {campaign.targets?.reach ? <p className="inline-flex items-center gap-1 text-xs font-semibold text-ai"><Target size={13} /> Target {compactNumber(campaign.targets.reach)} reach</p> : null}
      </div>
    </Panel>
  </div>;
}
