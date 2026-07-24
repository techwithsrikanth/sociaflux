"use client";

import { BrainCircuit, Building2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";

type LoginRole = "brand" | "creator";

const copy = {
  brand: {
    eyebrow: "Brand login",
    title: "Enter your brand workspace",
    text: "Build your brand persona, add products, compare creators, and launch campaigns.",
    button: "Continue as brand",
    href: "/brand/onboarding",
    icon: Building2
  },
  creator: {
    eyebrow: "Creator login",
    title: "Enter your creator workspace",
    text: "Analyze your profile, build your AI persona, set rates, and discover matched campaigns.",
    button: "Continue as creator",
    href: "/creator/onboarding",
    icon: UserRound
  }
};

export default function AuthPage({ role }: { role: LoginRole }) {
  const router = useRouter();
  const details = copy[role];
  const Icon = details.icon;
  return <main className="min-h-screen bg-paper px-6 py-6 text-ink">
    <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-5xl items-center justify-center">
      <section className="grid w-full overflow-hidden rounded-3xl border border-line bg-card shadow-panel lg:grid-cols-[1fr_420px]">
        <div className="p-8 md:p-12">
          <div className="mb-10 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-ai text-white"><BrainCircuit size={20} /></div><div><p className="text-sm font-semibold">SociaFlux</p><p className="text-xs text-graphite">AI creator matchmaking</p></div></div>
          <p className="text-xs font-semibold uppercase text-moss">{details.eyebrow}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-ink">{details.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-graphite">{details.text}</p>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            <label className="block text-sm font-medium text-graphite">Email<input className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink" placeholder={`${role}@sociaflux.ai`} /></label>
            <label className="block text-sm font-medium text-graphite">Password<input className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink" placeholder="••••••••" type="password" /></label>
          </div>
          <button className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-ai px-5 text-sm font-semibold text-white" onClick={() => (router.push as (href: string) => void)(details.href)} type="button"><Icon size={16} /> {details.button}</button>
          <button className="ml-3 mt-6 inline-flex h-11 items-center rounded-md border border-line bg-card px-5 text-sm font-semibold text-graphite" onClick={() => (router.push as (href: string) => void)("/")} type="button">Back</button>
        </div>
        <div className="border-t border-line bg-ai/5 p-8 lg:border-l lg:border-t-0"><div className="grid h-full place-items-center rounded-2xl border border-ai/20 bg-card p-8 text-center"><Icon className="mx-auto text-ai" size={44} /><p className="mt-5 text-lg font-semibold text-ink">Dedicated {role} side</p><p className="mt-2 text-sm leading-6 text-graphite">This is a product-style auth screen for demo access. Real authentication can be connected after deployment.</p></div></div>
      </section>
    </div>
  </main>;
}