"use client";

import { BrainCircuit, Building2, Loader2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signInBrand, signInCreator } from "@/lib/creator-store";

const productName = process.env.NEXT_PUBLIC_SOCIAFLUX_PRODUCT_NAME || "SociaFlux";

type LoginRole = "brand" | "creator";
type Mode = "signin" | "signup";

const copy = {
  brand: {
    eyebrow: "Brand login",
    title: "Enter your brand workspace",
    text: "Build your brand persona, add products, post campaigns, and review the creators who apply.",
    href: "/brand/onboarding",
    icon: Building2
  },
  creator: {
    eyebrow: "Creator login",
    title: "Enter your creator workspace",
    text: "Set your niches, upload your reels, set rates, and apply to brand campaigns.",
    href: "/creator/onboarding",
    icon: UserRound
  }
};

export default function AuthPage({ role }: { role: LoginRole }) {
  const router = useRouter();
  const details = copy[role];
  const Icon = details.icon;

  const [mode, setMode] = useState<Mode>("signin");
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [next, setNext] = useState("");

  // Middleware adds ?next= when it turns someone away, so they resume where
  // they were headed. Read from the URL directly rather than useSearchParams,
  // which forces this page out of static prerendering.
  useEffect(() => {
    const target = new URLSearchParams(window.location.search).get("next");
    if (target && target.startsWith("/")) setNext(target);
  }, []);

  async function submit() {
    setError("");

    if (mode === "signup" && role === "creator" && !handle.trim()) {
      return setError("Enter the Instagram handle you create under.");
    }
    if (!email.trim()) return setError("Enter your email address.");
    if (!password) return setError("Enter your password.");

    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode === "signup" ? "signup" : "login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(mode === "signup" ? { email, password, role, name, handle } : { email, password })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; user?: { role: LoginRole; handle?: string; name?: string } };

      if (!response.ok || !data.user) {
        setBusy(false);
        return setError(data.error || "Something went wrong. Try again.");
      }

      if (data.user.role !== role) {
        setBusy(false);
        return setError(`That account is a ${data.user.role} account. Use the ${data.user.role} login.`);
      }

      // The workspace still reads its handle from localStorage, so seed it from
      // the account rather than from whatever was typed.
      if (data.user.role === "creator" && data.user.handle) {
        signInCreator(data.user.handle, data.user.name || name, email);
      } else if (data.user.role === "brand") {
        signInBrand(data.user.name || name);
      }

      (router.push as (href: string) => void)(next || details.href);
      router.refresh();
    } catch {
      setBusy(false);
      setError("Could not reach the server. Check your connection and try again.");
    }
  }

  const signingUp = mode === "signup";

  return <main className="min-h-screen bg-paper px-6 py-6 text-ink">
    <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-5xl items-center justify-center">
      <section className="grid w-full overflow-hidden rounded-3xl border border-line bg-card shadow-panel lg:grid-cols-[1fr_420px]">
        <div className="p-8 md:p-12">
          <div className="mb-10 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-ai text-white"><BrainCircuit size={20} /></div><div><p className="text-sm font-semibold">{productName}</p><p className="text-xs text-graphite">AI creator matchmaking</p></div></div>
          <p className="text-xs font-semibold uppercase text-moss">{details.eyebrow}</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-ink">{signingUp ? `Create your ${role} account` : details.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-graphite">{details.text}</p>

          <div className="mt-8 inline-flex rounded-md border border-line bg-paper p-1">
            {(["signin", "signup"] as Mode[]).map((option) => <button className={`h-9 rounded px-4 text-sm font-semibold ${mode === option ? "bg-ai text-white" : "text-graphite"}`} key={option} onClick={() => { setMode(option); setError(""); }} type="button">{option === "signin" ? "Sign in" : "Create account"}</button>)}
          </div>

          <form className="mt-6 grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            {signingUp && role === "creator" ? <label className="block text-sm font-medium text-graphite">Instagram handle
              <input autoComplete="username" className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink" onChange={(event) => { setHandle(event.target.value); setError(""); }} placeholder="@yourhandle" value={handle} />
            </label> : null}
            {signingUp ? <label className="block text-sm font-medium text-graphite">{role === "brand" ? "Brand name" : "Display name"}
              <input className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink" onChange={(event) => setName(event.target.value)} placeholder={role === "brand" ? "Aura Atelier" : "Maya Chen"} value={name} />
            </label> : null}
            <label className="block text-sm font-medium text-graphite">Email
              <input autoComplete="email" className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink" onChange={(event) => { setEmail(event.target.value); setError(""); }} placeholder={`${role}@sociaflux.ai`} type="email" value={email} />
            </label>
            <label className="block text-sm font-medium text-graphite">Password
              <input autoComplete={signingUp ? "new-password" : "current-password"} className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink" onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="••••••••" type="password" value={password} />
            </label>

            {error ? <p className="text-sm text-coral md:col-span-2" role="alert">{error}</p> : null}
            {signingUp ? <p className="text-xs text-graphite md:col-span-2">At least 8 characters. Your email and password are how you sign back in.</p> : null}

            <div className="md:col-span-2">
              <button className="inline-flex h-11 items-center gap-2 rounded-md bg-ai px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? <Loader2 className="animate-spin" size={16} /> : <Icon size={16} />} {signingUp ? "Create account" : `Sign in as ${role}`}</button>
              <button className="ml-3 inline-flex h-11 items-center rounded-md border border-line bg-card px-5 text-sm font-semibold text-graphite" onClick={() => (router.push as (href: string) => void)("/")} type="button">Back</button>
            </div>
          </form>
        </div>
        <div className="border-t border-line bg-ai/5 p-8 lg:border-l lg:border-t-0"><div className="grid h-full place-items-center rounded-2xl border border-ai/20 bg-card p-8 text-center"><Icon className="mx-auto text-ai" size={44} /><p className="mt-5 text-lg font-semibold text-ink">Dedicated {role} side</p><p className="mt-2 text-sm leading-6 text-graphite">{signingUp ? "Your account is tied to your email. Sign in from any browser to pick up where you left off." : "Signed-in sessions last 30 days. The workspace stays private to your account."}</p></div></div>
      </section>
    </div>
  </main>;
}
