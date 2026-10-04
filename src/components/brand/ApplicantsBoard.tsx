"use client";

import { AtSign, BadgeCheck, CheckCircle2, Gauge, Lock, Mail, MapPin, Phone, Star, Target, Users, Wand2, X } from "lucide-react";
import { useMemo, useState } from "react";
import ReelGrid from "@/components/ReelGrid";
import { BriefAssetList } from "@/components/brand/BriefAssets";
import { Chip, EmptyState, GhostButton, Input, Metric, Panel, PrimaryButton, Select } from "@/components/ui";
import { matchCreatorToCampaign } from "@/lib/campaign-matching";
import { OBJECTIVE_LABEL, projectCampaign, projectCreator, suggestRoster, trackTargets } from "@/lib/campaign-metrics";
import type { CampaignMatch } from "@/lib/campaign-matching";
import type { CampaignProjection, TargetProgress } from "@/lib/campaign-metrics";
import { ALL_NICHES, FOLLOWER_TIERS } from "@/lib/niches";
import { APPLICATION_STATUS_LABEL, compactNumber, creatorNiches, isOpenForBarter, matchesNicheFilter, timeAgo } from "@/lib/marketplace";
import { COUNTRIES, regionLabel } from "@/lib/regions";
import type { Application, ApplicationStatus, Campaign } from "@/lib/marketplace";
import type { CreatorProfile } from "@/lib/types";

type Row = {
  application: Application;
  creator?: CreatorProfile;
  /** Weighted tag/region/barter fit, when the creator has a profile on file. */
  match?: CampaignMatch;
  /** Projected delivery if this applicant is approved at their quoted price. */
  projection?: ReturnType<typeof projectCreator>;
};

const SORTS = [
  { value: "match", label: "Best match" },
  { value: "reach", label: "Projected reach" },
  { value: "cpm", label: "Lowest CPM" },
  { value: "quote", label: "Lowest quote" },
  { value: "followers", label: "Most followers" },
  { value: "recent", label: "Most recent" }
];

export default function ApplicantsBoard({ applications, campaigns, creators, onDecide, selectedCampaignId, setSelectedCampaignId }: {
  applications: Application[];
  campaigns: Campaign[];
  creators: CreatorProfile[];
  onDecide: (applicationId: string, status: ApplicationStatus) => void;
  selectedCampaignId: string;
  setSelectedCampaignId: (value: string) => void;
}) {
  const [niche, setNiche] = useState("");
  const [minFollowers, setMinFollowers] = useState(0);
  const [maxPrice, setMaxPrice] = useState("");
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus | "">("");
  const [barterOnly, setBarterOnly] = useState(false);
  const [country, setCountry] = useState("");
  const [sort, setSort] = useState("match");
  const [qualifiedOnly, setQualifiedOnly] = useState(false);
  const [openProfile, setOpenProfile] = useState<Row | null>(null);

  const campaign = campaigns.find((item) => item.id === selectedCampaignId) || campaigns[0];

  const rows: Row[] = useMemo(() => applications
    .filter((application) => !campaign || application.campaignId === campaign.id)
    .map((application) => {
      const creator = creators.find((item) => item.handle === application.creatorHandle);
      if (!creator || !campaign) return { application, creator };
      return {
        application,
        creator,
        match: matchCreatorToCampaign(creator, campaign),
        projection: projectCreator(creator, campaign, application.quotedPrice)
      };
    }), [applications, campaign, creators]);

  const filtered = rows.filter(({ application, creator, match }) => {
    if (statusFilter && application.status !== statusFilter) return false;
    if (maxPrice && application.quotedPrice > Number(maxPrice)) return false;
    if (qualifiedOnly && !match?.eligible) return false;
    // Barter counts either way: offered in this application, or set on the profile.
    if (barterOnly && !application.openToBarter && !(creator && isOpenForBarter(creator))) return false;
    if (!creator) return !niche && !minFollowers && !country;
    if (niche && !matchesNicheFilter(creator, [niche])) return false;
    if (minFollowers && (creator.publicFollowerCount || 0) < minFollowers) return false;
    if (country && creator.location?.country !== country) return false;
    return true;
  });

  const visible = [...filtered].sort((left, right) => {
    switch (sort) {
      case "reach":
        return (right.projection?.reach || 0) - (left.projection?.reach || 0);
      case "cpm": {
        const leftCpm = left.projection?.cpm || Number.POSITIVE_INFINITY;
        const rightCpm = right.projection?.cpm || Number.POSITIVE_INFINITY;
        return leftCpm - rightCpm;
      }
      case "quote":
        return left.application.quotedPrice - right.application.quotedPrice;
      case "followers":
        return (right.creator?.publicFollowerCount || 0) - (left.creator?.publicFollowerCount || 0);
      case "recent":
        return new Date(right.application.appliedAt).getTime() - new Date(left.application.appliedAt).getTime();
      default:
        // Best match: qualified applicants first, then by score.
        if ((left.match?.eligible ?? false) !== (right.match?.eligible ?? false)) return left.match?.eligible ? -1 : 1;
        return (right.match?.score || 0) - (left.match?.score || 0);
    }
  });

  // The roster a brand has actually committed to drives the campaign plan.
  const selectedRows = rows.filter((row) => row.application.status === "approved" || row.application.status === "shortlisted");
  const approvedRows = rows.filter((row) => row.application.status === "approved");
  const projection: CampaignProjection | undefined = campaign
    ? projectCampaign(campaign, selectedRows.filter((row) => row.creator).map((row) => ({ creator: row.creator as CreatorProfile, quotedPrice: row.application.quotedPrice })))
    : undefined;
  const targetProgress = campaign && projection ? trackTargets(campaign.targets, projection) : [];

  function autoShortlist() {
    if (!campaign) return;
    const candidates = rows
      .filter((row) => row.creator && row.match?.eligible && row.application.status === "applied")
      .map((row) => ({ creator: row.creator as CreatorProfile, quotedPrice: row.application.quotedPrice }));
    const chosen = suggestRoster(campaign, candidates);
    const handles = new Set(chosen.map((entry) => entry.creator.handle));
    rows
      .filter((row) => handles.has(row.application.creatorHandle) && row.application.status === "applied")
      .forEach((row) => onDecide(row.application.id, "shortlisted"));
  }

  const counts = {
    applied: rows.filter((row) => row.application.status === "applied").length,
    shortlisted: rows.filter((row) => row.application.status === "shortlisted").length,
    approved: approvedRows.length,
    qualified: rows.filter((row) => row.match?.eligible).length
  };

  if (!campaigns.length) return <EmptyState text="Launch a campaign first. Once it is live, creators can see it in their feed and apply to it." />;

  return <div className="space-y-5">
    <Panel title="Applications">
      <p className="text-sm leading-6 text-graphite">Every creator who applied to this campaign, with their niches, audience size and portfolio. Approve a creator to unlock their email and phone number and move the collaboration off-platform.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Select label="Campaign" onChange={setSelectedCampaignId} value={campaign?.id || ""}>
          {campaigns.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </Select>
        <Select label="Status" onChange={(value) => setStatusFilter(value as ApplicationStatus | "")} value={statusFilter}>
          <option value="">All applicants</option>
          <option value="applied">New applications</option>
          <option value="shortlisted">Shortlisted</option>
          <option value="approved">Approved</option>
          <option value="rejected">Not selected</option>
        </Select>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-5">
        <Metric label="Applicants" value={String(rows.length)} />
        <Metric label="Qualified" value={`${counts.qualified}/${rows.length}`} />
        <Metric label="New" value={String(counts.applied)} />
        <Metric label="Shortlisted" value={String(counts.shortlisted)} />
        <Metric label="Approved" value={String(counts.approved)} />
      </div>
    </Panel>

    {campaign && projection ? <CampaignPlan campaign={campaign} progress={targetProgress} projection={projection} selected={selectedRows.length} /> : null}

    {campaign?.briefAssets?.length || campaign?.contentGuidelines ? <Panel title="This campaign's brief">
      {campaign.contentGuidelines ? <p className="mb-4 whitespace-pre-line text-sm leading-6 text-graphite">{campaign.contentGuidelines}</p> : null}
      <BriefAssetList assets={campaign.briefAssets || []} />
    </Panel> : null}

    <Panel title="Filter applicants">
      <div className="grid gap-3 md:grid-cols-4">
        <Select label="Niche" onChange={setNiche} value={niche}>
          <option value="">Any niche</option>
          {ALL_NICHES.map((item) => <option key={item} value={item}>{item}</option>)}
        </Select>
        <Select label="Audience size" onChange={(value) => setMinFollowers(Number(value))} value={String(minFollowers)}>
          {FOLLOWER_TIERS.map((tier) => <option key={tier.label} value={tier.min}>{tier.label}</option>)}
        </Select>
        <Input label="Max quote (USD)" onChange={setMaxPrice} placeholder="No limit" type="number" value={maxPrice} />
        <Select label="Based in" onChange={setCountry} value={country}>
          <option value="">Any country</option>
          {COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </Select>
      </div>
      <div className="mt-3 max-w-xs">
        <Select label="Sort by" onChange={setSort} value={sort}>
          {SORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </Select>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Chip active={qualifiedOnly} onClick={() => setQualifiedOnly(!qualifiedOnly)}>Qualified only</Chip>
        <Chip active={barterOnly} onClick={() => setBarterOnly(!barterOnly)}>Open to barter</Chip>
        {niche ? <Chip onClick={() => setNiche("")} tone="ai">{niche} &times;</Chip> : null}
        {minFollowers ? <Chip onClick={() => setMinFollowers(0)} tone="ai">{compactNumber(minFollowers)}+ followers &times;</Chip> : null}
        {country ? <Chip onClick={() => setCountry("")} tone="ai">{COUNTRIES.find((item) => item.code === country)?.name || country} &times;</Chip> : null}
        <span className="ml-auto text-xs text-graphite">{visible.length} of {rows.length} applicants</span>
      </div>
      {counts.applied ? <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <GhostButton onClick={autoShortlist}><Wand2 size={15} /> Auto-shortlist best value</GhostButton>
        <p className="text-xs text-graphite">Shortlists qualified new applicants by lowest cost per person reached, stopping at your reach target or budget. Never approves anyone.</p>
      </div> : null}
    </Panel>

    {visible.length ? <div className="space-y-4">
      {visible.map((row, index) => <ApplicantCard key={row.application.id} onDecide={onDecide} onOpen={() => setOpenProfile(row)} rank={sort === "match" ? index + 1 : undefined} row={row} />)}
    </div> : <EmptyState text={rows.length ? "No applicants match these filters." : "No applications yet for this campaign. Creators see it in their campaign feed as soon as it is launched."} />}

    {openProfile ? <ProfileModal onClose={() => setOpenProfile(null)} onDecide={onDecide} row={openProfile} /> : null}
  </div>;
}

function StatusPill({ status }: { status: ApplicationStatus }) {
  const style = status === "approved" ? "bg-moss text-white" : status === "rejected" ? "border border-line bg-paper text-graphite" : status === "shortlisted" ? "border border-gold/30 bg-gold/5 text-gold" : "border border-ai/20 bg-ai/5 text-ai";
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{APPLICATION_STATUS_LABEL[status]}</span>;
}

function ApplicantCard({ onDecide, onOpen, rank, row }: { onDecide: (id: string, status: ApplicationStatus) => void; onOpen: () => void; rank?: number; row: Row }) {
  const { application, creator, match, projection } = row;
  const approved = application.status === "approved";
  const reels = creator?.reels || [];
  return <article className={`rounded-lg border bg-card p-5 shadow-panel ${match && !match.eligible ? "border-line opacity-80" : "border-line"}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          {rank ? <span className="grid h-7 w-7 place-items-center rounded-full border border-ai/30 bg-ai/5 text-xs font-semibold text-ai">{rank}</span> : null}
          <h3 className="text-lg font-semibold text-ink">{creator?.name || application.creatorHandle}</h3>
          <StatusPill status={application.status} />
          {application.openToBarter ? <Chip>Offered barter</Chip> : null}
          {creator && isOpenForBarter(creator) ? <Chip>Open to barter</Chip> : null}
          {creator?.location ? <Chip>{regionLabel(creator.location)}</Chip> : null}
        </div>
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-graphite"><AtSign size={13} />{application.creatorHandle.replace("@", "")} &middot; applied {timeAgo(application.appliedAt)}</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-graphite">{application.pitch}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {creator ? creatorNiches(creator).slice(0, 5).map((item) => <Chip key={item}>{item}</Chip>) : null}
        </div>
      </div>
      <div className="shrink-0 lg:w-80">
        {match ? <ScoreCard match={match} /> : null}
        <div className="mt-3 grid grid-cols-3 gap-3">
          <Metric label="Followers" value={creator?.publicFollowerCount ? compactNumber(creator.publicFollowerCount) : "—"} />
          <Metric label="Quote" value={`$${application.quotedPrice.toLocaleString()}`} />
          <Metric label="Reels" value={String(reels.length)} />
        </div>
        {projection ? <div className="mt-3 grid grid-cols-3 gap-3">
          <Metric label="Est. reach" value={compactNumber(projection.reach)} />
          <Metric label="Est. CPM" value={projection.cpm ? `$${projection.cpm}` : "—"} />
          <Metric label="Est. engage" value={compactNumber(projection.engagements)} />
        </div> : null}
      </div>
    </div>

    {match && !match.eligible ? <p className="mt-4 rounded-md border border-gold/30 bg-gold/5 p-3 text-xs text-gold">Does not meet the campaign rules: {match.exclusionReasons.join(" · ")}</p> : null}

    {reels.length ? <div className="mt-5">
      <p className="mb-3 text-xs font-semibold uppercase text-graphite">Portfolio</p>
      <ReelGrid columns={3} reels={reels.slice(0, 3)} />
    </div> : <p className="mt-5 rounded-md border border-dashed border-line bg-paper p-4 text-sm text-graphite">This creator has not attached portfolio work.</p>}

    {approved ? <ContactPanel creator={creator} /> : <p className="mt-5 inline-flex items-center gap-2 rounded-md border border-line bg-paper p-3 text-xs text-graphite"><Lock size={13} /> Contact details unlock when you approve this creator.</p>}

    <div className="mt-5 flex flex-wrap items-center gap-3">
      <GhostButton onClick={onOpen}><Users size={15} /> View full profile</GhostButton>
      {application.status !== "shortlisted" && !approved ? <GhostButton onClick={() => onDecide(application.id, "shortlisted")}><Star size={15} /> Shortlist</GhostButton> : null}
      {!approved ? <PrimaryButton onClick={() => onDecide(application.id, "approved")}><BadgeCheck size={15} /> Approve for campaign</PrimaryButton> : null}
      {application.status !== "rejected" && !approved ? <button className="text-sm font-semibold text-coral" onClick={() => onDecide(application.id, "rejected")} type="button">Not a fit</button> : null}
      {approved ? <button className="text-sm font-semibold text-graphite" onClick={() => onDecide(application.id, "shortlisted")} type="button">Undo approval</button> : null}
    </div>
  </article>;
}

function ScoreCard({ match }: { match: CampaignMatch }) {
  const bars: Array<{ label: string; value: number }> = [
    { label: "Tags", value: match.breakdown.tagScore },
    { label: "Region", value: match.breakdown.regionScore },
    { label: "Barter", value: match.breakdown.barterScore }
  ];
  return <div className={`rounded-lg border p-3 ${match.eligible ? "border-ai/20 bg-ai/5" : "border-line bg-paper"}`}>
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-wide text-graphite">Match score</p>
      <p className={`text-xl font-semibold ${match.eligible ? "text-ai" : "text-graphite"}`}>{match.score}</p>
    </div>
    <div className="mt-2 space-y-1.5">
      {bars.map((bar) => <div key={bar.label}>
        <div className="flex items-center justify-between text-[11px] text-graphite">
          <span>{bar.label}</span><span>{Math.round(bar.value * 100)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-card">
          <div className="h-full rounded-full bg-ai" style={{ width: `${Math.round(bar.value * 100)}%` }} />
        </div>
      </div>)}
    </div>
  </div>;
}

function CampaignPlan({ campaign, progress, projection, selected }: { campaign: Campaign; progress: TargetProgress[]; projection: CampaignProjection; selected: number }) {
  const format = (item: TargetProgress, value: number) =>
    item.format === "currency" ? `$${value.toLocaleString()}` : item.format === "percent" ? `${value}%` : compactNumber(value);

  return <Panel title="Campaign plan">
    <p className="text-sm leading-6 text-graphite">
      Projected delivery from the {selected} creator{selected === 1 ? "" : "s"} you have shortlisted or approved, for a {OBJECTIVE_LABEL[campaign.objective || "awareness"].toLowerCase()} campaign.
      These are planning estimates from follower counts and typical delivery rates, not measured results.
    </p>
    <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Metric label="Est. reach" value={compactNumber(projection.reach)} />
      <Metric label="Est. impressions" value={compactNumber(projection.impressions)} />
      <Metric label="Est. engagements" value={compactNumber(projection.engagements)} />
      <Metric label="Est. conversions" value={String(projection.conversions)} />
      <Metric label="Est. CPM" value={projection.cpm ? `$${projection.cpm}` : "—"} />
      <Metric label="Committed spend" value={`$${projection.cost.toLocaleString()}`} />
    </div>

    <div className={`mt-4 rounded-md border p-3 text-sm ${projection.overBudget ? "border-coral/40 bg-coral/5 text-coral" : "border-line bg-paper text-graphite"}`}>
      <span className="inline-flex items-center gap-2"><Gauge size={15} />
        {projection.overBudget
          ? `Over budget by $${Math.abs(projection.budgetRemaining).toLocaleString()} of a $${projection.budget.toLocaleString()} budget.`
          : `$${projection.budgetRemaining.toLocaleString()} of the $${projection.budget.toLocaleString()} budget still unspent.`}
      </span>
    </div>

    {progress.length ? <div className="mt-5 space-y-3">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-graphite"><Target size={13} /> Targets</p>
      {progress.map((item) => <div key={item.metric}>
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink">{item.label}{item.lowerIsBetter ? " (max)" : ""}</span>
          <span className={item.met ? "font-semibold text-moss" : "text-graphite"}>
            {format(item, item.projected)} / {format(item, item.target)}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-card">
          <div className={`h-full rounded-full ${item.met ? "bg-moss" : "bg-ai"}`} style={{ width: `${Math.min(100, Math.round(item.ratio * 100))}%` }} />
        </div>
      </div>)}
    </div> : <p className="mt-4 text-xs text-graphite">No targets set for this campaign. Add them when posting a campaign to track delivery against a goal.</p>}
  </Panel>;
}

function ContactPanel({ creator }: { creator?: CreatorProfile }) {
  const contact = creator?.contact;
  return <div className="mt-5 rounded-lg border border-moss/30 bg-moss/5 p-4">
    <p className="inline-flex items-center gap-2 text-sm font-semibold text-moss"><CheckCircle2 size={15} /> Approved &mdash; contact details unlocked</p>
    {contact?.email || contact?.phone ? <div className="mt-3 grid gap-3 md:grid-cols-3">
      {contact.email ? <a className="inline-flex items-center gap-2 rounded-md border border-line bg-card p-3 text-sm text-ink" href={`mailto:${contact.email}`}><Mail size={15} /> {contact.email}</a> : null}
      {contact.phone ? <span className="inline-flex items-center gap-2 rounded-md border border-line bg-card p-3 text-sm text-ink"><Phone size={15} /> {contact.phone}</span> : null}
      {contact.city || contact.country ? <span className="inline-flex items-center gap-2 rounded-md border border-line bg-card p-3 text-sm text-ink"><MapPin size={15} /> {[contact.city, contact.country].filter(Boolean).join(", ")}</span> : null}
      {contact.managerEmail ? <a className="inline-flex items-center gap-2 rounded-md border border-line bg-card p-3 text-sm text-ink md:col-span-2" href={`mailto:${contact.managerEmail}`}><Mail size={15} /> Manager: {contact.managerEmail}</a> : null}
    </div> : <p className="mt-2 text-sm text-graphite">This creator has not filled in contact details during onboarding yet.</p>}
  </div>;
}

function ProfileModal({ onClose, onDecide, row }: { onClose: () => void; onDecide: (id: string, status: ApplicationStatus) => void; row: Row }) {
  const { application, creator } = row;
  const approved = application.status === "approved";
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
    <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-line bg-card p-6 shadow-panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-moss">Applicant profile</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">{creator?.name || application.creatorHandle}</h2>
          <p className="mt-1 text-sm text-graphite">{application.creatorHandle} &middot; {creator?.primaryNiche}</p>
        </div>
        <button aria-label="Close" className="rounded-md border border-line p-2 text-graphite" onClick={onClose} type="button"><X size={16} /></button>
      </div>

      {creator ? <>
        <p className="mt-4 text-sm leading-6 text-graphite">{creator.summary}</p>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <Metric label="Followers" value={creator.publicFollowerCount ? compactNumber(creator.publicFollowerCount) : "—"} />
          <Metric label="Posts" value={creator.publicPostCount ? compactNumber(creator.publicPostCount) : "—"} />
          <Metric label="Brand safety" value={`${creator.brandSafety.overallScore}/100`} />
          <Metric label="Quote" value={`$${application.quotedPrice.toLocaleString()}`} />
        </div>
        <div className="mt-5 flex flex-wrap gap-2">{creatorNiches(creator).map((item) => <Chip key={item}>{item}</Chip>)}</div>
        <div className="mt-5">
          <p className="mb-3 text-xs font-semibold uppercase text-graphite">Portfolio ({creator.reels?.length || 0})</p>
          <ReelGrid reels={creator.reels || []} />
        </div>
      </> : <p className="mt-4 text-sm text-graphite">This creator has not published a full profile on the platform yet.</p>}

      <div className="mt-5 rounded-md border border-line bg-paper p-4">
        <p className="text-xs font-semibold uppercase text-graphite">Their pitch</p>
        <p className="mt-2 text-sm leading-6 text-graphite">{application.pitch}</p>
      </div>

      {approved ? <ContactPanel creator={creator} /> : null}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        {!approved ? <PrimaryButton onClick={() => onDecide(application.id, "approved")}><BadgeCheck size={15} /> Approve and unlock contact</PrimaryButton> : null}
        {!approved ? <GhostButton onClick={() => onDecide(application.id, "shortlisted")}><Star size={15} /> Shortlist</GhostButton> : null}
        <GhostButton onClick={onClose}>Close</GhostButton>
      </div>
    </div>
  </div>;
}
