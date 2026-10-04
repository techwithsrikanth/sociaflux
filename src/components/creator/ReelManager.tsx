"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import ReelGrid from "@/components/ReelGrid";
import { Input, Panel, PrimaryButton, Select } from "@/components/ui";
import { CONTENT_FORMATS, NICHE_TAXONOMY } from "@/lib/niches";
import { createId, instagramEmbedUrl } from "@/lib/marketplace";
import type { ContentFormat } from "@/lib/niches";
import type { Reel } from "@/lib/types";

const emptyDraft = { url: "", title: "", format: "Reel" as ContentFormat, niche: "", views: "", likes: "", comments: "", brand: "" };

export default function ReelManager({ defaultNiche, onChange, reels }: { defaultNiche: string; onChange: (reels: Reel[]) => void; reels: Reel[] }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");

  function addReel() {
    const url = draft.url.trim();
    if (!/^https?:\/\//i.test(url)) return setError("Paste the full link to the post, starting with https://");
    if (reels.some((reel) => reel.url === url)) return setError("That link is already in your portfolio.");
    const reel: Reel = {
      id: createId("reel"),
      url,
      title: draft.title.trim() || "Portfolio work",
      format: draft.format,
      niche: draft.niche || defaultNiche,
      views: Number(draft.views) || undefined,
      likes: Number(draft.likes) || undefined,
      comments: Number(draft.comments) || undefined,
      brand: draft.brand.trim() || undefined,
      addedAt: new Date().toISOString()
    };
    onChange([reel, ...reels]);
    setDraft(emptyDraft);
    setError("");
  }

  const previewable = Boolean(instagramEmbedUrl(draft.url));
  return <div className="space-y-5">
    <Panel title="Add work to your portfolio">
      <p className="text-sm leading-6 text-graphite">Paste links to reels, posts, and UGC you have already published. Brands see these the moment they shortlist you, so lead with work that matches the campaigns you want.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input label="Post or reel link" onChange={(value) => setDraft({ ...draft, url: value })} placeholder="https://instagram.com/reel/..." value={draft.url} />
        <Input label="Title" onChange={(value) => setDraft({ ...draft, title: value })} placeholder="Barrier serum routine" value={draft.title} />
        <Select label="Format" onChange={(value) => setDraft({ ...draft, format: value as ContentFormat })} value={draft.format}>
          {CONTENT_FORMATS.map((format) => <option key={format} value={format}>{format}</option>)}
        </Select>
        <Select label="Niche" onChange={(value) => setDraft({ ...draft, niche: value })} value={draft.niche}>
          <option value="">{defaultNiche || "Select a niche"}</option>
          {NICHE_TAXONOMY.map((group) => <optgroup key={group.category} label={group.category}>
            {group.niches.map((niche) => <option key={niche} value={niche}>{niche}</option>)}
          </optgroup>)}
        </Select>
        <Input label="Views" onChange={(value) => setDraft({ ...draft, views: value })} placeholder="120000" type="number" value={draft.views} />
        <Input label="Likes" onChange={(value) => setDraft({ ...draft, likes: value })} placeholder="8400" type="number" value={draft.likes} />
        <Input label="Comments" onChange={(value) => setDraft({ ...draft, comments: value })} placeholder="310" type="number" value={draft.comments} />
        <Input label="Brand (if it was a paid collab)" onChange={(value) => setDraft({ ...draft, brand: value })} placeholder="Aura Atelier" value={draft.brand} />
      </div>
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      <div className="mt-4 flex items-center gap-3">
        <PrimaryButton onClick={addReel}><Plus size={16} /> Add to portfolio</PrimaryButton>
        <p className="text-xs text-graphite">{previewable ? "Instagram preview available for this link." : "Non-Instagram links are saved as outbound links."}</p>
      </div>
    </Panel>
    <Panel title={`Portfolio (${reels.length})`}>
      <ReelGrid onRemove={(id) => onChange(reels.filter((reel) => reel.id !== id))} reels={reels} />
    </Panel>
  </div>;
}
