"use client";

import { BrainCircuit, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const productName = process.env.NEXT_PUBLIC_SOCIAFLUX_PRODUCT_NAME || "SociaFlux";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ role: string } | null>(null);

  // The token rides in the query string of the emailed link. Read it directly
  // rather than with useSearchParams, which forces a Suspense boundary and
  // breaks static prerendering elsewhere in this app.
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get("token") || "");
  }, []);

  async function submit() {
    setError("");
    if (!password) return setError("Enter a new password.");
    if (password !== confirm) return setError("Those passwords do not match.");

    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string; role?: string };
      if (!response.ok) {
        setBusy(false);
        return setError(data.error || "Something went wrong. Try again.");
      }
      setDone({ role: data.role || "creator" });
    } catch {
      setBusy(false);
      setError("Could not reach the server. Check your connection and try again.");
    }
  }

  const loginHref = done?.role === "brand" ? "/brand/login" : "/creator/login";

  return <main className="min-h-screen bg-paper px-6 py-6 text-ink">
    <div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-md items-center justify-center">
      <section className="w-full rounded-3xl border border-line bg-card p-8 shadow-panel md:p-10">
        <div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-md bg-ai text-white"><BrainCircuit size={20} /></div><div><p className="text-sm font-semibold">{productName}</p><p className="text-xs text-graphite">Password reset</p></div></div>

        {done ? <div>
          <p className="inline-flex items-center gap-2 text-lg font-semibold text-moss"><CheckCircle2 size={20} /> Password updated</p>
          <p className="mt-3 text-sm leading-6 text-graphite">You can now sign in with your new password.</p>
          <button className="mt-6 inline-flex h-11 items-center rounded-md bg-ai px-5 text-sm font-semibold text-white" onClick={() => (router.push as (href: string) => void)(loginHref)} type="button">Go to sign in</button>
        </div> : !token ? <div>
          <h1 className="text-2xl font-semibold text-ink">Link not found</h1>
          <p className="mt-3 text-sm leading-6 text-graphite">This page needs the reset link from your email. Open the most recent link, or request a new one from the sign-in page.</p>
          <button className="mt-6 inline-flex h-11 items-center rounded-md border border-line bg-card px-5 text-sm font-semibold text-graphite" onClick={() => (router.push as (href: string) => void)("/creator/login")} type="button">Back to sign in</button>
        </div> : <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
          <h1 className="text-2xl font-semibold text-ink">Choose a new password</h1>
          <p className="mt-3 text-sm leading-6 text-graphite">This link works once. Pick a password you have not used here before.</p>

          <label className="mt-6 block text-sm font-medium text-graphite">New password
            <input autoComplete="new-password" className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink" onChange={(event) => { setPassword(event.target.value); setError(""); }} placeholder="••••••••" type="password" value={password} />
          </label>
          <label className="mt-3 block text-sm font-medium text-graphite">Confirm password
            <input autoComplete="new-password" className="mt-1 h-11 w-full rounded-md border border-line bg-paper px-3 text-ink" onChange={(event) => { setConfirm(event.target.value); setError(""); }} placeholder="••••••••" type="password" value={confirm} />
          </label>

          {error ? <p className="mt-3 text-sm text-coral" role="alert">{error}</p> : null}
          <p className="mt-3 text-xs text-graphite">At least 8 characters.</p>

          <button className="mt-6 inline-flex h-11 items-center gap-2 rounded-md bg-ai px-5 text-sm font-semibold text-white disabled:opacity-60" disabled={busy} type="submit">{busy ? <Loader2 className="animate-spin" size={16} /> : null} Update password</button>
        </form>}
      </section>
    </div>
  </main>;
}
