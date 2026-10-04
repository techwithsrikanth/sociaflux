"use client";

import { Eye, Heart, MessageCircle, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { compactNumber, instagramEmbedUrl } from "@/lib/marketplace";
import type { Reel } from "@/lib/types";

export default function ReelGrid({ columns = 3, onRemove, reels }: { columns?: 2 | 3; onRemove?: (id: string) => void; reels: Reel[] }) {
  if (!reels.length) return <p className="rounded-md border border-dashed border-line bg-paper p-6 text-center text-sm text-graphite">No portfolio work added yet.</p>;
  return <div className={`grid gap-4 ${columns === 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3"}`}>
    {reels.map((reel) => <ReelCard key={reel.id} onRemove={onRemove} reel={reel} />)}
  </div>;
}

function ReelCard({ onRemove, reel }: { onRemove?: (id: string) => void; reel: Reel }) {
  const [playing, setPlaying] = useState(false);
  const embed = instagramEmbedUrl(reel.url);
  return <article className="overflow-hidden rounded-lg border border-line bg-card shadow-panel">
    {playing && embed
      ? <iframe allowFullScreen className="h-[480px] w-full border-0 bg-paper" loading="lazy" src={embed} title={reel.title} />
      : <button className="group relative grid h-44 w-full place-items-center bg-gradient-to-br from-ai/20 via-card to-paper" onClick={() => setPlaying(true)} type="button">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-ai text-white shadow-panel transition group-hover:scale-110"><Play size={20} /></span>
          <span className="absolute bottom-3 left-3 rounded-full bg-paper/80 px-2 py-1 text-[11px] font-semibold text-graphite">{reel.format}</span>
        </button>}
    <div className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{reel.title || "Untitled work"}</p>
          <p className="mt-1 text-xs text-graphite">{reel.niche}{reel.brand ? ` · for ${reel.brand}` : ""}</p>
        </div>
        {onRemove ? <button aria-label="Remove" className="shrink-0 rounded-md border border-line p-1.5 text-graphite hover:text-coral" onClick={() => onRemove(reel.id)} type="button"><Trash2 size={14} /></button> : null}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-graphite">
        {reel.views ? <span className="inline-flex items-center gap-1"><Eye size={13} /> {compactNumber(reel.views)}</span> : null}
        {reel.likes ? <span className="inline-flex items-center gap-1"><Heart size={13} /> {compactNumber(reel.likes)}</span> : null}
        {reel.comments ? <span className="inline-flex items-center gap-1"><MessageCircle size={13} /> {compactNumber(reel.comments)}</span> : null}
      </div>
      <div className="flex items-center gap-3">
        <a className="text-xs font-semibold text-ai" href={reel.url} rel="noreferrer" target="_blank">Open on Instagram</a>
        {playing ? <button className="text-xs font-semibold text-graphite" onClick={() => setPlaying(false)} type="button">Close preview</button> : null}
      </div>
    </div>
  </article>;
}
