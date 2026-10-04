"use client";

import { FileText, Film, ImageIcon, Link2, Paperclip, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { GhostButton, Input, Select, TextArea } from "@/components/ui";
import { BRIEF_ASSET_LABEL, createId } from "@/lib/marketplace";
import type { BriefAsset, BriefAssetKind } from "@/lib/marketplace";

const KIND_ICON: Record<BriefAssetKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  document: FileText,
  link: Link2
};

const emptyDraft = { kind: "image" as BriefAssetKind, url: "", title: "", note: "" };

/** Guesses the asset kind from the file extension so the brand rarely has to pick. */
function kindFromUrl(url: string): BriefAssetKind | null {
  if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i.test(url)) return "image";
  if (/\.(mp4|mov|webm|m4v|avi)(\?|#|$)/i.test(url)) return "video";
  if (/\.(pdf|docx?|pptx?|xlsx?|csv|txt|key|pages)(\?|#|$)/i.test(url)) return "document";
  return null;
}

export function BriefAssetEditor({ assets, onChange }: { assets: BriefAsset[]; onChange: (assets: BriefAsset[]) => void }) {
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState("");

  function add() {
    const url = draft.url.trim();
    if (!/^https?:\/\//i.test(url)) return setError("Paste a full link starting with https://");
    if (assets.some((asset) => asset.url === url)) return setError("That file is already attached.");

    onChange([
      ...assets,
      {
        id: createId("asset"),
        kind: draft.kind,
        url,
        title: draft.title.trim() || BRIEF_ASSET_LABEL[draft.kind],
        note: draft.note.trim() || undefined
      }
    ]);
    setDraft(emptyDraft);
    setError("");
  }

  function setUrl(value: string) {
    const detected = kindFromUrl(value);
    setDraft((current) => ({ ...current, url: value, kind: detected || current.kind }));
    setError("");
  }

  return <div className="space-y-4">
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_160px]">
      <Input label="File or link" onChange={setUrl} placeholder="https://drive.google.com/..." value={draft.url} />
      <Input label="Title" onChange={(value) => setDraft({ ...draft, title: value })} placeholder="Reference reel we love" value={draft.title} />
      <Select label="Type" onChange={(value) => setDraft({ ...draft, kind: value as BriefAssetKind })} value={draft.kind}>
        {(Object.keys(BRIEF_ASSET_LABEL) as BriefAssetKind[]).map((kind) => <option key={kind} value={kind}>{BRIEF_ASSET_LABEL[kind]}</option>)}
      </Select>
    </div>
    <TextArea label="What should creators take from this?" onChange={(value) => setDraft({ ...draft, note: value })} placeholder="Match this pacing and the hook in the first 2 seconds." rows={2} value={draft.note} />
    {error ? <p className="text-sm text-coral">{error}</p> : null}
    <GhostButton onClick={add}><Plus size={15} /> Attach to brief</GhostButton>

    {assets.length
      ? <BriefAssetList assets={assets} onRemove={(id) => onChange(assets.filter((asset) => asset.id !== id))} />
      : <p className="text-xs text-graphite">Nothing attached yet. Creators work best from a reference image, a sample reel, or a one-page brief.</p>}
  </div>;
}

export function BriefAssetList({ assets, onRemove }: { assets: BriefAsset[]; onRemove?: (id: string) => void }) {
  if (!assets.length) return <p className="text-sm text-graphite">No reference material attached.</p>;

  return <div className="grid gap-3 md:grid-cols-2">
    {assets.map((asset) => {
      const Icon = KIND_ICON[asset.kind];
      return <article className="overflow-hidden rounded-lg border border-line bg-paper" key={asset.id}>
        {asset.kind === "image"
          // Reference images come from arbitrary hosts, so next/image optimisation is not usable here.
          // eslint-disable-next-line @next/next/no-img-element
          ? <img alt={asset.title} className="h-36 w-full bg-card object-cover" loading="lazy" src={asset.url} />
          : asset.kind === "video"
            ? <video className="h-36 w-full bg-card object-cover" controls preload="metadata" src={asset.url} />
            : <div className="grid h-20 w-full place-items-center bg-card text-graphite"><Icon size={24} /></div>}
        <div className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{asset.title}</p>
              <p className="text-[11px] uppercase tracking-wide text-graphite">{BRIEF_ASSET_LABEL[asset.kind]}</p>
            </div>
            {onRemove ? <button aria-label="Remove" className="shrink-0 rounded-md border border-line p-1.5 text-graphite hover:text-coral" onClick={() => onRemove(asset.id)} type="button"><Trash2 size={13} /></button> : null}
          </div>
          {asset.note ? <p className="text-xs leading-5 text-graphite">{asset.note}</p> : null}
          <a className="inline-flex items-center gap-1 text-xs font-semibold text-ai" href={asset.url} rel="noreferrer" target="_blank"><Paperclip size={12} /> Open</a>
        </div>
      </article>;
    })}
  </div>;
}
