"use client";

import { Briefcase, CalendarClock, CheckCircle2, CircleAlert, Clock, Eye, FileText, Search, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Chip, EmptyState, GhostButton, Input, Panel, PrimaryButton, Select, TextArea } from "@/components/ui";
import { ALL_NICHES } from "@/lib/niches";
import { RegionChips } from "@/components/RegionFields";
import { BriefAssetList } from "@/components/brand/BriefAssets";
import { eligibleForCampaign } from "@/lib/campaign-matching";
import { OBJECTIVE_LABEL } from "@/lib/campaign-metrics";
import { APPLICATION_STATUS_LABEL, BARTER_POLICY_LABEL, compactNumber, creatorAskingPrice, timeAgo } from "@/lib/marketplace";
import type { Application, Campaign } from "@/lib/marketplace";
import type { CreatorProfile } from "@/lib/types";

type Scored = { campaign: Campaign; score: number };

export default function CampaignBoard({ applications, creator, items, onApply, onWithdraw, setSort, sort }: {
  applications: Application[];
  creator: CreatorProfile;
  items: Scored[];
  onApply: (campaign: Campaign, draft: { pitch: string; quotedPrice: number; openToBarter: boolean }) => void;
  onWithdraw: (applicationId: string) => void;
  setSort: (value: string) => void;
  sort: string;
}) {
  const [query, setQuery] = useState("");
  const [niche, setNiche] = useState("");
  const [onlyEligible, setOnlyEligible] = useState(false);
  const [applyTo, setApplyTo] = useState<Campaign | null>(null);
  const [briefFor, setBriefFor] = useState<Campaign | null>(null);

  const applicationFor = (campaignId: string) => applications.find((item) => item.campaignId === campaignId);

  const visible = useMemo(() => items.filter(({ campaign }) => {
    const haystack = [campaign.name, campaign.product, campaign.goal, campaign.audience, campaign.creatorType, campaign.brandName, ...(campaign.targetNiches || [])].join(" ").toLowerCase();
    if (query && !haystack.includes(query.toLowerCase())) return false;
    if (niche && !(campaign.targetNiches || []).includes(niche)) return false;
    if (onlyEligible && !eligibleForCampaign(creator, campaign).eligible) return false;
    return true;
  }), [creator, items, niche, onlyEligible, query]);

  return <div className="space-y-5">
    <Panel title="Open campaigns">
      <p className="text-sm leading-6 text-graphite">Brands post campaigns here. Apply with a pitch and your quote &mdash; the brand reviews your profile and portfolio, and your contact details stay private until they approve you.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2"><Input label="Search campaigns" onChange={setQuery} placeholder="Skincare launch, UGC, Bangalore..." value={query} /></div>
        <Select label="Niche" onChange={setNiche} value={niche}>
          <option value="">All niches</option>
          {ALL_NICHES.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Select label="Sort by" onChange={setSort} value={sort}>
          <option value="match">Highest match</option>
          <option value="budget">Highest budget</option>
          <option value="recent">Most recent</option>
          <option value="name">Campaign name</option>
        </Select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip active={onlyEligible} onClick={() => setOnlyEligible(!onlyEligible)}>Only campaigns I qualify for</Chip>
        {niche ? <Chip onClick={() => setNiche("")} tone="ai">{niche} &times;</Chip> : null}
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-graphite"><Search size={13} /> {visible.length} of {items.length} campaigns</span>
      </div>
    </Panel>

    {visible.length ? <div className="grid gap-4 lg:grid-cols-2">
      {visible.map(({ campaign, score }) => <CampaignCard application={applicationFor(campaign.id)} campaign={campaign} creator={creator} key={campaign.id} onApply={() => setApplyTo(campaign)} onViewBrief={() => setBriefFor(campaign)} onWithdraw={onWithdraw} score={score} />)}
    </div> : <EmptyState text="No campaigns match these filters yet. Clear a filter, or check back after brands post new campaigns." />}

    {applyTo ? <ApplyModal campaign={applyTo} creator={creator} onClose={() => setApplyTo(null)} onSubmit={(draft) => { onApply(applyTo, draft); setApplyTo(null); }} /> : null}
    {briefFor ? <BriefModal campaign={briefFor} onApply={() => { setApplyTo(briefFor); setBriefFor(null); }} onClose={() => setBriefFor(null)} /> : null}
  </div>;
}

function CampaignCard({ application, campaign, creator, onApply, onViewBrief, onWithdraw, score }: {
  application?: Application;
  campaign: Campaign;
  creator: CreatorProfile;
  onApply: () => void;
  onViewBrief: () => void;
  onWithdraw: (applicationId: string) => void;
  score: number;
}) {
  const { eligible, reasons } = eligibleForCampaign(creator, campaign);
  return <article className="flex flex-col rounded-lg border border-line bg-card p-5 shadow-panel">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-moss"><Briefcase size={13} /> {campaign.brandName || "Brand campaign"}</p>
        <h3 className="mt-1 text-lg font-semibold text-ink">{campaign.name}</h3>
        <p className="mt-1 text-sm text-graphite">{campaign.product} &middot; {campaign.duration} &middot; posted {timeAgo(campaign.postedAt)}</p>
      </div>
      <div className={`shrink-0 rounded-md border px-4 py-3 text-center ${score >= 90 ? "border-ai/20 bg-ai/5 text-ai" : "border-line bg-paper text-ink"}`}>
        <p className="text-2xl font-semibold">{score}</p><p className="text-xs text-graphite">Match</p>
      </div>
    </div>

    <p className="mt-4 text-sm leading-6 text-graphite">Goal: {campaign.goal}</p>
    <p className="mt-1 text-sm leading-6 text-graphite">Audience: {campaign.audience}</p>
    {campaign.deliverables?.length ? <p className="mt-1 text-sm leading-6 text-graphite">Deliverables: {campaign.deliverables.join(", ")}</p> : null}

    <div className="mt-4 flex flex-wrap gap-2">
      <Chip tone="ai">Budget ${campaign.budget.toLocaleString()}</Chip>
      {campaign.minFollowers ? <Chip>{compactNumber(campaign.minFollowers)}+ followers</Chip> : null}
      {campaign.barterPolicy && campaign.barterPolicy !== "paid" ? <Chip tone="ai">{BARTER_POLICY_LABEL[campaign.barterPolicy]}</Chip> : null}
      <RegionChips regions={campaign.targetRegions || []} />
      {campaign.objective ? <Chip>{OBJECTIVE_LABEL[campaign.objective]}</Chip> : null}
      {(campaign.targetNiches || []).slice(0, 4).map((item) => <Chip key={item}>{item}</Chip>)}
    </div>

    {campaign.submissionDeadline ? <p className="mt-3 inline-flex items-center gap-1 text-xs text-graphite"><CalendarClock size={13} /> Submissions due {campaign.submissionDeadline}</p> : null}

    {!eligible && !application ? <p className="mt-4 inline-flex items-start gap-2 rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-gold"><CircleAlert className="mt-0.5 shrink-0" size={14} /> {reasons.join(" · ")}. You can still apply, but the brand filters on this.</p> : null}

    <div className="mt-auto pt-5">
      {application ? <div className="flex flex-wrap items-center gap-3">
        <GhostButton onClick={onViewBrief}><Eye size={15} /> View full brief</GhostButton>
        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${application.status === "approved" ? "bg-moss text-white" : application.status === "rejected" ? "border border-line bg-paper text-graphite" : "border border-ai/20 bg-ai/5 text-ai"}`}>
          {application.status === "approved" ? <CheckCircle2 size={13} /> : <Clock size={13} />} {APPLICATION_STATUS_LABEL[application.status]}
        </span>
        <span className="text-xs text-graphite">Applied {timeAgo(application.appliedAt)} &middot; quoted ${application.quotedPrice.toLocaleString()}</span>
        {application.status === "applied" ? <button className="text-xs font-semibold text-coral" onClick={() => onWithdraw(application.id)} type="button">Withdraw</button> : null}
        {application.status === "approved" ? <span className="w-full text-xs text-moss">The brand approved you and can now see your contact details. Expect an email shortly.</span> : null}
      </div> : <div className="flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={onApply}><Send size={15} /> Apply to campaign</PrimaryButton>
        <GhostButton onClick={onViewBrief}><Eye size={15} /> View full brief</GhostButton>
      </div>}
    </div>
  </article>;
}

/** Everything the brand attached about how the content should be made. */
export function CampaignBriefPanel({ campaign }: { campaign: Campaign }) {
  const lists: Array<[string, string[] | undefined]> = [
    ["Must include", campaign.mustInclude],
    ["Must avoid", campaign.mustAvoid],
    ["Hashtags", campaign.hashtags],
    ["Mentions", campaign.mentions]
  ];

  return <div className="space-y-5">
    {campaign.contentGuidelines ? <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">How the content should go</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-graphite">{campaign.contentGuidelines}</p>
    </div> : null}

    {campaign.creatorRequirements ? <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Who the brand wants</p>
      <p className="mt-2 whitespace-pre-line text-sm leading-6 text-graphite">{campaign.creatorRequirements}</p>
    </div> : null}

    {campaign.deliverables?.length ? <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Deliverables</p>
      <div className="mt-2 flex flex-wrap gap-2">{campaign.deliverables.map((item) => <Chip key={item} tone="ai">{item}</Chip>)}</div>
    </div> : null}

    {lists.filter(([, values]) => values?.length).map(([label, values]) => <div key={label}>
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">{(values || []).map((item) => <Chip key={item}>{item}</Chip>)}</div>
    </div>)}

    {campaign.usageRights ? <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Usage rights</p>
      <p className="mt-2 text-sm leading-6 text-graphite">{campaign.usageRights}</p>
    </div> : null}

    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Reference material</p>
      <div className="mt-2"><BriefAssetList assets={campaign.briefAssets || []} /></div>
    </div>
  </div>;
}

function BriefModal({ campaign, onApply, onClose }: { campaign: Campaign; onApply: () => void; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl border border-line bg-card p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1 text-xs font-semibold uppercase text-moss"><FileText size={13} /> Campaign brief</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{campaign.name}</h2>
          <p className="mt-1 text-sm text-graphite">{campaign.brandName || "Brand"} &middot; budget ${campaign.budget.toLocaleString()}</p>
        </div>
        <button className="text-sm text-graphite" onClick={onClose} type="button">Close</button>
      </div>
      <div className="mt-5"><CampaignBriefPanel campaign={campaign} /></div>
      <div className="mt-6 flex items-center gap-3">
        <PrimaryButton onClick={onApply}><Send size={15} /> Apply to campaign</PrimaryButton>
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>
    </div>
  </div>;
}

function ApplyModal({ campaign, creator, onClose, onSubmit }: {
  campaign: Campaign;
  creator: CreatorProfile;
  onClose: () => void;
  onSubmit: (draft: { pitch: string; quotedPrice: number; openToBarter: boolean }) => void;
}) {
  const [pitch, setPitch] = useState(`I create ${creator.primaryNiche.toLowerCase()} content for ${creator.estimatedAudience.ageGroups.join(", ")} audiences. For ${campaign.product}, I would ${campaign.creatorType.toLowerCase()} across ${(campaign.deliverables || ["one reel"]).join(" and ")}.`);
  const [quotedPrice, setQuotedPrice] = useState(String(creatorAskingPrice(creator) || campaign.budget));
  const [openToBarter, setOpenToBarter] = useState(false);
  const reelCount = creator.reels?.length || 0;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-line bg-card p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-moss">Apply to campaign</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{campaign.name}</h2>
          <p className="mt-1 text-sm text-graphite">{campaign.brandName || "Brand"} &middot; budget ${campaign.budget.toLocaleString()}</p>
        </div>
        <button className="text-sm text-graphite" onClick={onClose} type="button">Close</button>
      </div>

      {campaign.contentGuidelines || campaign.briefAssets?.length ? <div className="mt-5 rounded-md border border-line bg-paper p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-graphite">What the brand asked for</p>
        {campaign.contentGuidelines ? <p className="mt-2 whitespace-pre-line text-sm leading-6 text-graphite">{campaign.contentGuidelines}</p> : null}
        {campaign.briefAssets?.length ? <p className="mt-2 text-xs text-graphite">{campaign.briefAssets.length} reference file{campaign.briefAssets.length === 1 ? "" : "s"} attached &mdash; open the full brief to review them.</p> : null}
      </div> : null}

      <div className="mt-5 space-y-4">
        <TextArea label="Your pitch" onChange={setPitch} rows={5} value={pitch} />
        <div className="grid gap-3 md:grid-cols-2">
          <Input label="Your quote (USD)" onChange={setQuotedPrice} type="number" value={quotedPrice} />
          <label className="flex items-end gap-2 pb-2 text-sm text-graphite">
            <input checked={openToBarter} className="h-4 w-4" onChange={(event) => setOpenToBarter(event.target.checked)} type="checkbox" /> Open to barter collaboration
          </label>
        </div>
        <div className="rounded-md border border-line bg-paper p-4 text-sm text-graphite">
          <p className="font-semibold text-ink">What the brand sees</p>
          <p className="mt-2 leading-6">Your persona, niches, audience analytics and {reelCount} portfolio {reelCount === 1 ? "reel" : "reels"}. Your email and phone number stay hidden until they approve you.</p>
          {reelCount === 0 ? <p className="mt-2 text-gold">Add at least one reel to your portfolio first &mdash; applications with work attached get reviewed far more often.</p> : null}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <PrimaryButton onClick={() => onSubmit({ pitch, quotedPrice: Number(quotedPrice) || 0, openToBarter })}><Send size={15} /> Send application</PrimaryButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  </div>;
}
