"use client";

export function Panel(props: { actions?: React.ReactNode; children: React.ReactNode; title: string }) {
  return <section className="rounded-lg border border-line bg-card p-5 shadow-panel">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{props.title}</h2>{props.actions}</div>
    <div className="mt-4">{props.children}</div>
  </section>;
}

export function Input(props: { label: string; onChange: (value: string) => void; placeholder?: string; type?: string; value: string }) {
  return <label className="block text-sm font-medium text-graphite">{props.label}
    <input className="mt-1 h-10 w-full rounded-md border border-line bg-paper px-3 text-ink" onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} type={props.type || "text"} value={props.value} />
  </label>;
}

export function TextArea(props: { label: string; onChange: (value: string) => void; placeholder?: string; rows?: number; value: string }) {
  return <label className="block text-sm font-medium text-graphite">{props.label}
    <textarea className="mt-1 w-full rounded-md border border-line bg-paper px-3 py-2 text-ink" onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} rows={props.rows || 3} value={props.value} />
  </label>;
}

export function Select(props: { children: React.ReactNode; label: string; onChange: (value: string) => void; value: string }) {
  return <label className="block text-sm font-medium text-graphite">{props.label}
    <select className="mt-1 h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink" onChange={(event) => props.onChange(event.target.value)} value={props.value}>{props.children}</select>
  </label>;
}

export function Chip(props: { active?: boolean; children: React.ReactNode; onClick?: () => void; tone?: "ai" | "neutral" }) {
  const base = "rounded-full px-3 py-1 text-xs font-semibold transition";
  const style = props.active ? "bg-ai text-white" : props.tone === "ai" ? "border border-ai/20 bg-ai/5 text-ai" : "border border-line bg-paper text-graphite hover:border-ai/40 hover:text-ink";
  if (!props.onClick) return <span className={`${base} ${style}`}>{props.children}</span>;
  return <button className={`${base} ${style}`} onClick={props.onClick} type="button">{props.children}</button>;
}

export function Metric(props: { label: string; value: string }) {
  return <div className="rounded-md border border-line bg-card p-3"><p className="text-xs text-graphite">{props.label}</p><p className="mt-1 truncate font-semibold">{props.value}</p></div>;
}

export function EmptyState(props: { children?: React.ReactNode; text: string }) {
  return <div className="rounded-lg border border-dashed border-line bg-paper p-8 text-center"><p className="text-sm text-graphite">{props.text}</p>{props.children ? <div className="mt-4">{props.children}</div> : null}</div>;
}

export function PrimaryButton(props: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button className="inline-flex h-10 items-center gap-2 rounded-md bg-ai px-4 text-sm font-semibold text-white disabled:opacity-40" disabled={props.disabled} onClick={props.onClick} type="button">{props.children}</button>;
}

export function GhostButton(props: { children: React.ReactNode; disabled?: boolean; onClick: () => void }) {
  return <button className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-card px-4 text-sm font-semibold text-graphite disabled:opacity-40" disabled={props.disabled} onClick={props.onClick} type="button">{props.children}</button>;
}
