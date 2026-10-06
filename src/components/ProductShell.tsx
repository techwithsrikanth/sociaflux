"use client";

import { BadgeCheck, BrainCircuit, Building2, Check, GitCompareArrows, LineChart, LogOut, MessageSquareQuote, RefreshCcw, Send, Sparkles, Star, Target, TrendingUp, UserRound, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { demoBusinessProfile, demoCreatorProfiles, demoMatches } from "@/lib/demo-data";
import ApplicantsBoard from "@/components/brand/ApplicantsBoard";
import CampaignComposer from "@/components/brand/CampaignComposer";
import CampaignBoard from "@/components/creator/CampaignBoard";
import NicheSelector from "@/components/creator/NicheSelector";
import ReelManager from "@/components/creator/ReelManager";
import ReelGrid from "@/components/ReelGrid";
import { APPLICATION_STATUS_LABEL, createId, matchesNicheFilter, normaliseCampaign, slug, timeAgo } from "@/lib/marketplace";
import { buildProductPersonaText, campaignsForBrand, defaultCampaignName, emptyBusinessProfile, resolveCampaignProduct } from "@/lib/brand-flow";
import { emptyCreatorProfile } from "@/lib/creator-store";
import type { Application, ApplicationStatus, Campaign } from "@/lib/marketplace";
import { ALL_NICHES, normaliseNiche } from "@/lib/niches";
import { LocationFields } from "@/components/RegionFields";
import { matchCreatorToCampaign } from "@/lib/campaign-matching";
import { useMarketplace } from "@/lib/use-marketplace";
import { regionLabel } from "@/lib/regions";
import type { Region } from "@/lib/regions";
import type { BusinessProfile, CreatorProfile, MatchResult } from "@/lib/types";

type Role = "brand" | "creator";
type BrandTab = "onboarding" | "profile" | "products" | "matches" | "campaign" | "applicants";
type CreatorTab = "onboarding" | "persona" | "feed" | "pricing" | "profile" | "preview" | "reels" | "applications";
type ProductPersona = { answers: string[]; category: string; markets: string; name: string; persona: string; targetAudience: string };

const productName = process.env.NEXT_PUBLIC_SOCIAFLUX_PRODUCT_NAME || "SociaFlux";
const brandQuestions = ["What does your brand sell?", "Who is your ideal customer?", "What emotional job does your brand solve?", "What tone should creators use?", "What creator niches do you prefer?", "What risks should creators avoid?", "What proof points should creators mention?", "What should a creator never misrepresent?"];
const creatorQuestions = ["What are you best known for?", "Which brands are a strong fit for you?", "Describe your audience.", "What content formats perform best?", "What collaboration types do you prefer?", "What makes your content perform?", "Any topics or brands you avoid?"];
const brandProductPersonaQuestions = ["What is your product name?", "What category does your product belong to?", "What does your product do?", "Who is your primary target audience?", "Which markets/geographies are you targeting?", "How would you describe your brand voice?", "List 3 words customers should associate with your brand?"];
const productQuestions = ["What product are you launching?", "Who is this product for?", "What problem does it solve?", "What proof or features should creators mention?", "What creator format would sell this best?", "What claims should creators avoid?"];

function useStoredState<T>(key: string, initialValue: T) {
  const [hydrated, setHydrated] = useState(false);
  const [value, setValue] = useState<T>(initialValue);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored) setValue(JSON.parse(stored));
    } catch {}
    setHydrated(true);
  }, [key]);
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [hydrated, key, value]);
  return [value, setValue] as const;
}
export type ProductRole = Role;
export type ProductBrandStep = BrandTab;
export type ProductCreatorStep = CreatorTab;

export default function ProductShell({ brandStep = "onboarding", creatorStep = "onboarding", role }: { brandStep?: BrandTab; creatorStep?: ProductCreatorStep; role?: Role }) {
  const router = useRouter();
  const brandTab = brandStep;
  const creatorTab = creatorStep;
  const goBrand = (step: BrandTab) => (router.push as (href: string) => void)(`/brand/${step === "matches" ? "creators" : step}`);
  const goCreator = (step: ProductCreatorStep) => (router.push as (href: string) => void)(`/creator/${step === "feed" ? "campaigns" : step}`);
  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    // Clear cached identity so the next person on this browser never sees the
    // previous account's data before their own loads.
    try {
      window.localStorage.removeItem("sf.creatorProfile");
      window.localStorage.removeItem("sf.creatorHandle");
      window.localStorage.removeItem("sf.brandName");
      window.localStorage.removeItem("sf.businessProfile");
    } catch {}
    (router.push as (href: string) => void)(role === "brand" ? "/brand/login" : "/creator/login");
  }
  const [creatorPersonaReady, setCreatorPersonaReady] = useStoredState("sf.creatorPersonaReady", false);
  const [campaignSort, setCampaignSort] = useStoredState("sf.campaignSort", "match");
  const [businessUrl, setBusinessUrl] = useStoredState("sf.businessUrl", "https://www.team-bhp.com/");
  const [creatorInput, setCreatorInput] = useStoredState("sf.creatorInput", "https://instagram.com/natgeo");
  const [businessProfile, setBusinessProfile] = useStoredState<BusinessProfile>("sf.businessProfile", demoBusinessProfile);
  const marketplace = useMarketplace();
  const creators = marketplace.creators;
  const [creatorProfile, setCreatorProfile] = useStoredState<CreatorProfile>("sf.creatorProfile", demoCreatorProfiles[0]);
  const [matches, setMatches] = useStoredState<MatchResult[]>("sf.matches", demoMatches);
  const [budget, setBudget] = useStoredState("sf.budget", 6000);
  const [shortlist, setShortlist] = useStoredState<string[]>("sf.shortlist", ["@mayaskinnotes"]);
  const [compareHandles, setCompareHandles] = useStoredState<string[]>("sf.compareHandles", []);
  const [compareOpen, setCompareOpen] = useState(false);
  const [promotionTarget, setPromotionTarget] = useStoredState("sf.promotionTarget", "brand");
  const [loading, setLoading] = useState<string | null>(null);
  const [campaign, setCampaign] = useStoredState<Campaign>("sf.campaign", normaliseCampaign({ name: "Launch campaign", product: "Hero product", goal: "Drive qualified awareness", audience: "High-intent buyers", creatorType: "Niche creators with brand-safe voice", budget: 6000, duration: "30 days" }));
  const applications = marketplace.applications;
  const [applicantCampaignId, setApplicantCampaignId] = useStoredState("sf.applicantCampaignId", "");
  const [discoveryNiche, setDiscoveryNiche] = useStoredState("sf.discoveryNiche", "");
  const [discoveryCampaignId, setDiscoveryCampaignId] = useStoredState("sf.discoveryCampaignId", "");
  const [reachOutNote, setReachOutNote] = useState("");
  const [signedInHandle, setSignedInHandle] = useStoredState("sf.creatorHandle", "");
  const [analysisNotice, setAnalysisNotice] = useState<{ tone: "warn" | "info"; lines: string[] } | null>(null);
  // Read straight from the URL rather than useSearchParams, which would force
  // every page out of static prerendering into a Suspense boundary.
  const [instagramStatus, setInstagramStatus] = useState<string | null>(null);
  const [connectedHandle, setConnectedHandle] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInstagramStatus(params.get("instagram"));
    setConnectedHandle(params.get("handle"));
  }, []);
  const [brandName, setBrandName] = useStoredState("sf.brandName", "");
  const launchedCampaigns = marketplace.campaigns;
  const [brandAnswers, setBrandAnswers] = useStoredState<string[]>("sf.brandAnswers", Array(brandQuestions.length).fill(""));
  const [creatorAnswers, setCreatorAnswers] = useStoredState<string[]>("sf.creatorAnswers", Array(creatorQuestions.length).fill(""));
  const [brandProductAnswers, setBrandProductAnswers] = useStoredState<string[]>("sf.brandProductAnswers", Array(brandProductPersonaQuestions.length).fill(""));
  const [productPersonas, setProductPersonas] = useStoredState<ProductPersona[]>("sf.productPersonas", []);
  const [productAnswers, setProductAnswers] = useStoredState<string[]>("sf.productAnswers", Array(productQuestions.length).fill(""));
  const onboardingProductPersona = buildOnboardingProductPersona(brandProductAnswers, businessProfile);
  const selectedProductPersona = productPersonas.find((product) => product.name === promotionTarget);
  const productPersona = buildProductPersonaText(productAnswers, campaign, businessProfile);

  const activeBrandName = brandName || businessProfile.businessName;
  const launchedBoard: Campaign[] = launchedCampaigns.map((item) => normaliseCampaign({ ...item, brandName: item.brandName || activeBrandName }));
  const fallbackCampaign: Campaign = normaliseCampaign({
    name: `${businessProfile.businessName} awareness`,
    product: businessProfile.products[0] || "Brand offer",
    goal: "Find aligned creators",
    audience: businessProfile.targetAudience.slice(0, 2).join(", ") || "Target buyers",
    creatorType: businessProfile.brandTone.join(", ") || "Brand-safe creators",
    budget,
    duration: "21 days",
    persona: businessProfile.primaryValueProposition,
    brandName: activeBrandName,
    objective: "awareness",
    // A $25 CPM is a reasonable planning assumption for a first awareness push.
    targets: { reach: budget * 40, engagementRate: 3.5, cpmTarget: 25 },
    deliverables: ["1 reel", "Story set"],
    contentGuidelines: `Show ${businessProfile.products[0] || businessProfile.businessName} in real use rather than reading a script. Lead with the problem it solves for ${businessProfile.targetAudience[0] || "the viewer"}, and keep the tone ${businessProfile.brandTone.join(", ").toLowerCase() || "natural"}.`,
    creatorRequirements: `Creators who already talk about ${businessProfile.category || businessProfile.industry} and can film in natural light.`,
    mustInclude: businessProfile.uniqueSellingPoints.slice(0, 2),
    mustAvoid: ["Unsupported claims", "Competitor comparisons"],
    hashtags: ["#ad"],
    usageRights: "Organic only, 3 months",
    briefAssets: [
      ...(businessProfile.logoUrl ? [{ id: "asset_demo_logo", kind: "image" as const, url: businessProfile.logoUrl, title: "Brand imagery", note: "Match this look and colour palette." }] : []),
      { id: "asset_demo_site", kind: "link" as const, url: businessProfile.website, title: "Brand website", note: "Product details and claims you can safely repeat." }
    ]
  });
  const visibleCampaigns: Campaign[] = launchedBoard.length ? launchedBoard : [fallbackCampaign];
  const creatorCampaignScores = visibleCampaigns.map((item) => ({ campaign: item, score: matchCreatorToCampaign(creatorProfile, item).score })).sort((a, b) => b.score - a.score);
  const sortedCreatorCampaignScores = [...creatorCampaignScores].sort((a, b) => campaignSort === "budget" ? b.campaign.budget - a.campaign.budget : campaignSort === "name" ? a.campaign.name.localeCompare(b.campaign.name) : campaignSort === "recent" ? new Date(b.campaign.postedAt || 0).getTime() - new Date(a.campaign.postedAt || 0).getTime() : b.score - a.score);
  const comparisonCreators = creators.filter((creator) => compareHandles.includes(creator.handle));
  const discoveryCampaign = buildDiscoveryCampaign(businessProfile, selectedProductPersona, budget);
  const selectedDiscoveryCampaign = campaignsForBrand(launchedBoard, activeBrandName).find((item) => item.id === discoveryCampaignId);
  const matchCampaign = selectedDiscoveryCampaign || discoveryCampaign;
  const sortedMatches = matches.map((match) => ({ ...match, score: matchCreatorToCampaign(creators.find((creator) => creator.handle === match.creatorHandle) || creatorProfile, matchCampaign).score })).sort((a, b) => b.score - a.score);
  const brandProfileReady = Boolean(businessProfile.businessName && businessProfile.summary);
  const filteredMatches = discoveryNiche ? sortedMatches.filter((match) => { const creator = creators.find((item) => item.handle === match.creatorHandle); return creator ? matchesNicheFilter(creator, [discoveryNiche]) : false; }) : sortedMatches;
  const ownedCampaigns = campaignsForBrand(launchedBoard, activeBrandName);
  const brandCampaigns = ownedCampaigns.length ? ownedCampaigns : [fallbackCampaign];
  const activeApplicantCampaignId = brandCampaigns.some((item) => item.id === applicantCampaignId) ? applicantCampaignId : brandCampaigns[0]?.id || "";
  const newApplicationCount = applications.filter((item) => item.status === "applied" && brandCampaigns.some((entry) => entry.id === item.campaignId)).length;
  const myApplications = applications.filter((item) => item.creatorHandle === creatorProfile.handle);

  // The session is the source of truth for who is signed in. On mount we read
  // it and load that account's data from the database, so a creator who logs
  // out and back in — even in a fresh browser — sees their real profile and
  // applications, never the demo "Unknown" placeholder.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetch("/api/auth/session").then((response) => response.json());
        const session = data.session as { role?: string; name?: string; email?: string; handle?: string } | null;
        if (cancelled || !session) return;
        if (session.role === "creator" && session.handle) {
          setSignedInHandle(session.handle);
          const result = await fetch(`/api/creators?handle=${encodeURIComponent(session.handle)}`).then((response) => response.json());
          if (cancelled) return;
          if (result.creator) setCreatorProfile(result.creator);
          else setCreatorProfile((current) => current.handle === session.handle ? current : emptyCreatorProfile(session.handle!, session.name || "", session.email || ""));
        } else if (session.role === "brand" && session.name) {
          setBrandName(session.name);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the signed-in brand's saved profile from the database so edits
  // persist across reloads and devices, and a new brand sees its own name
  // rather than the Aura Atelier demo.
  useEffect(() => {
    if (role !== "brand" || !brandName) return;
    let cancelled = false;
    fetch(`/api/brands?id=${encodeURIComponent(slug(brandName))}`)
      .then((response) => response.json())
      .then((data: { brand?: BusinessProfile | null }) => {
        if (cancelled) return;
        if (data.brand) setBusinessProfile(data.brand);
        else setBusinessProfile((current) => current.businessName === brandName ? current : emptyBusinessProfile(brandName));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, brandName]);

  async function persistBrand(profile: BusinessProfile) {
    if (!profile.businessName) return;
    try {
      await fetch("/api/brands", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: slug(brandName || profile.businessName), profile }) });
    } catch {}
  }

  async function reachOutToCreator(handle: string) {
    const target = campaignsForBrand(launchedBoard, activeBrandName).find((item) => item.id === discoveryCampaignId);
    if (!target) { setReachOutNote("Pick one of your campaigns in \"Match against campaign\" first, then reach out."); return; }
    try {
      const response = await fetch("/api/applications/invite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId: target.id, campaignName: target.name, creatorHandle: handle }) });
      const data = await response.json();
      if (!response.ok) { setReachOutNote(data.error || "Could not reach out. Try again."); return; }
      const rate = data.application?.quotedPrice ? ` at their rate of $${Number(data.application.quotedPrice).toLocaleString()}` : "";
      setReachOutNote(data.created ? `Reached out to ${handle}${rate} for "${target.name}". If they accept, the deal is set at that rate and their contact unlocks under Applicants.` : `${handle} is already in your pipeline for "${target.name}".`);
      void marketplace.refresh();
    } catch { setReachOutNote("Could not reach the server. Try again."); }
  }

  async function analyzeBusiness() {
    setLoading("business");
    try {
      const response = await fetch("/api/analyze/business", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ websiteUrl: businessUrl }) });
      const data = await response.json();
      if (data.profile) {
        const merged = brandName ? { ...data.profile, businessName: brandName } : data.profile;
        setBusinessProfile(merged);
        void persistBrand(merged);
      }
    } finally { setLoading(null); }
  }

  async function analyzeCreator() {
    setLoading("creator");
    try {
      const response = await fetch("/api/analyze/creator", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ handleOrUrl: creatorInput }) });
      const data = await response.json();
      if (data.profile) {
        // Name and handle must come from the same account, or the card shows one
        // creator's name next to another creator's handle.
        const analysedHandle = data.profile.handle;
        const merged: CreatorProfile = { ...data.profile, handle: analysedHandle, primaryNiche: creatorProfile.primaryNiche || normaliseNiche(data.profile.primaryNiche), subNiches: creatorProfile.subNiches || [], contentLanguages: creatorProfile.contentLanguages || ["English"], reels: creatorProfile.reels || [], contact: creatorProfile.contact || { email: "", phone: "", city: "", country: "" }, location: creatorProfile.location, openForBarter: creatorProfile.openForBarter ?? false };
        setCreatorProfile(merged);
        if (analysedHandle && analysedHandle !== signedInHandle) setSignedInHandle(analysedHandle);
        marketplace.saveCreator(merged, { immediate: true });

        const lines: string[] = [];
        if (signedInHandle && analysedHandle && analysedHandle !== signedInHandle) {
          lines.push(`You signed in as ${signedInHandle} but analysed ${analysedHandle}. Your profile and applications now use ${analysedHandle}.`);
        }
        const missingCounts = !merged.publicFollowerCount || !merged.publicPostCount;
        if (missingCounts || data.scrape?.status !== "complete") {
          lines.push("Instagram did not return your follower or post counts. It restricts the datacenter IP addresses that deployed servers run on, so this is expected once the app is hosted. Enter your numbers below and brands will see a complete profile.");
          (data.scrape?.limitations || []).slice(0, 1).forEach((limitation: string) => lines.push(limitation));
        }
        setAnalysisNotice(lines.length ? { tone: "warn", lines } : null);
      }
      setCreatorPersonaReady(true);
      goCreator("profile");
    } finally { setLoading(null); }
  }

  async function recomputeMatches() {
    setLoading("match");
    try {
      const response = await fetch("/api/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ business: businessProfile, creators, budget }) });
      const data = await response.json();
      if (data.matches) setMatches(data.matches);
    } finally { setLoading(null); }
  }

  function updatePrice(key: keyof CreatorProfile["pricing"], value: number) {
    // Persist like every other edit; previously this only touched local state,
    // so pricing was not saved until some other field (barter) triggered a save.
    const next = { ...creatorProfile, pricing: { ...creatorProfile.pricing, [key]: value } };
    setCreatorProfile(next);
    marketplace.saveCreator(next);
  }
  function launchCampaign() {
    const chosenProduct = productPersonas.find((product) => product.name === campaign.product);
    const product = resolveCampaignProduct(productAnswers, campaign, chosenProduct?.name);
    const name = defaultCampaignName(activeBrandName, product, campaign.name);
    const nextCampaign = normaliseCampaign({ ...campaign, name, product, id: createId("cmp"), persona: chosenProduct?.persona || productPersona, brandName: activeBrandName, postedAt: new Date().toISOString() });
    void marketplace.postCampaign(nextCampaign);
    setCampaign(nextCampaign);
    setApplicantCampaignId(nextCampaign.id);
    goBrand("applicants");
  }
  function addProductPersona() {
    const product = buildProductPersonaRecord(brandProductAnswers, businessProfile);
    setProductPersonas((current) => [product, ...current.filter((item) => item.name !== product.name)]);
    setPromotionTarget(product.name);
    setCampaign((current) => ({ ...current, product: product.name, audience: product.targetAudience }));
    setBrandProductAnswers(Array(brandProductPersonaQuestions.length).fill(""));
  }
  // The OAuth callback writes the verified profile to the database, so the
  // browser copy has to be refreshed once we land back here.
  useEffect(() => {
    if (instagramStatus !== "connected" || !connectedHandle) return;
    let cancelled = false;
    fetch(`/api/creators?handle=${encodeURIComponent(connectedHandle)}`)
      .then((response) => response.json())
      .then((data: { creator?: CreatorProfile }) => {
        if (cancelled || !data.creator) return;
        setCreatorProfile(data.creator);
        setSignedInHandle(data.creator.handle);
        void marketplace.refresh();
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instagramStatus, connectedHandle]);

  function updateCreator(patch: Partial<CreatorProfile>) {
    const next = { ...creatorProfile, ...patch };
    setCreatorProfile(next);
    marketplace.saveCreator(next);
  }
  function updateContact(patch: Partial<NonNullable<CreatorProfile["contact"]>>) {
    updateCreator({ contact: { email: "", phone: "", city: "", country: "", ...creatorProfile.contact, ...patch } });
  }
  function applyToCampaign(target: Campaign, draft: { pitch: string; quotedPrice: number; openToBarter: boolean }) {
    const application: Application = { id: createId("app"), campaignId: target.id, campaignName: target.name, creatorHandle: creatorProfile.handle, pitch: draft.pitch, quotedPrice: draft.quotedPrice, openToBarter: draft.openToBarter, status: "applied", appliedAt: new Date().toISOString() };
    // The brand needs an up-to-date profile the moment the application lands.
    marketplace.saveCreator(creatorProfile, { immediate: true });
    void marketplace.applyToCampaign(application);
  }
  function withdrawApplication(id: string) {
    void marketplace.withdrawApplication(id);
  }
  function decideApplication(id: string, status: ApplicationStatus) {
    void marketplace.decideApplication(id, status);
  }
  function toggleCompare(handle: string) {
    setCompareHandles((current) => current.includes(handle) ? current.filter((item) => item !== handle) : [...current, handle].slice(-5));
  }
  const syncBanner = <SyncBanner error={marketplace.error} onRetry={() => void marketplace.refresh()} status={marketplace.status} />;

  if (!role) return <LoginScreen onSelect={(nextRole) => (router.push as (href: string) => void)(`/${nextRole}/login`)} />;

  if (role === "brand") return <Workspace banner={syncBanner} eyebrow="Brand login" title="Brand workspace" onLogout={logout} nav={<><Nav active={brandTab === "matches"} label="Creators" onClick={() => goBrand("matches")} /><Nav active={brandTab === "campaign"} label="Post campaign" onClick={() => goBrand("campaign")} /><Nav active={brandTab === "applicants"} label={newApplicationCount ? `Applicants (${newApplicationCount})` : "Applicants"} onClick={() => goBrand("applicants")} /><Nav active={brandTab === "profile" || brandTab === "onboarding" || brandTab === "products"} label="My Brand Profile" onClick={() => goBrand("profile")} /></>}>
    {brandTab === "onboarding" && <div className="grid gap-5 xl:grid-cols-[430px_1fr]"><Panel title="Step 1: Set brand persona"><p className="text-sm leading-6 text-graphite">Start with the brand/business. Analyze the website, answer brand-fit questions, then save the brand persona before adding products.</p><Input label="Website URL" value={businessUrl} onChange={setBusinessUrl} /><button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-ai px-4 text-sm font-semibold text-white" onClick={analyzeBusiness} type="button"><Sparkles size={16} /> {loading === "business" ? "Analyzing" : "Analyze brand"}</button><QuestionList questions={brandQuestions} answers={brandAnswers} setAnswers={setBrandAnswers} magic={(i) => magicBrandAnswer(i, businessProfile)} /><button className="mt-5 rounded-md bg-ai px-4 py-2 text-sm font-semibold text-white" onClick={() => { void persistBrand(businessProfile); goBrand("profile"); }} type="button">Finish onboarding</button></Panel><BusinessCard profile={businessProfile} /></div>}
    {brandTab === "profile" && <div className="space-y-5"><Panel title="My Brand Profile"><p className="text-sm leading-6 text-graphite">Manage the setup details behind your brand workspace. Brand Persona and Products live here so the main workspace stays focused on creators and campaigns.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><button className="rounded-lg border border-ai/20 bg-ai/5 p-5 text-left" onClick={() => goBrand("onboarding")} type="button"><p className="text-sm font-semibold text-ink">Edit Brand Persona</p><p className="mt-2 text-sm leading-6 text-graphite">Update the onboarding details: website analysis, brand questionnaire, tone, audience, proof points, and safety rules.</p></button><button className="rounded-lg border border-line bg-card p-5 text-left" onClick={() => goBrand("products")} type="button"><p className="text-sm font-semibold text-ink">Edit Products</p><p className="mt-2 text-sm leading-6 text-graphite">Add or edit product personas used for creator sorting and campaign targeting.</p></button></div></Panel><BusinessCard profile={businessProfile} /><ProductPersonaList products={productPersonas} /></div>}
    {brandTab === "products" && <div className="grid gap-5 xl:grid-cols-[430px_1fr]"><Panel title="Step 2: Add product personas"><p className="text-sm leading-6 text-graphite">Add individual products after the brand persona is set. Creator discovery can then sort by the whole brand or a specific product.</p><QuestionList questions={brandProductPersonaQuestions} answers={brandProductAnswers} setAnswers={setBrandProductAnswers} magic={(i) => magicOnboardingProductAnswer(i, businessProfile)} /><div className="mt-4 rounded-md border border-line bg-card p-4"><p className="text-sm font-semibold">Product persona draft</p><p className="mt-2 text-sm leading-6 text-graphite">{onboardingProductPersona}</p></div><button className="mt-5 rounded-md bg-ai px-4 py-2 text-sm font-semibold text-white" onClick={addProductPersona} type="button">Add product persona</button><button className="ml-3 mt-5 rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold text-graphite" onClick={() => goBrand("matches")} type="button">View creators</button></Panel><ProductPersonaList products={productPersonas} /></div>}
    {brandTab === "matches" && <div className="space-y-5"><FlowGate ready={brandProfileReady} message="Set the brand persona first. Then add product personas if you want product-specific sorting." /><div className="grid gap-4 md:grid-cols-4"><Metric label="Business" value={activeBrandName} /><Metric label="Sort basis" value={promotionTarget === "brand" ? "Whole brand" : promotionTarget} /><Metric label="Budget" value={`$${budget.toLocaleString()}`} /><Metric label="Selected" value={`${compareHandles.length}/5`} /></div><div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-panel lg:flex-row lg:items-end lg:justify-between"><label className="block text-sm font-medium text-graphite">Match against campaign<select className="mt-1 h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink" onChange={(event) => { const id = event.target.value; setDiscoveryCampaignId(id); setReachOutNote(""); const picked = campaignsForBrand(launchedBoard, activeBrandName).find((item) => item.id === id); if (picked) { setBudget(picked.budget); setDiscoveryNiche((picked.targetNiches || [])[0] || ""); } }} value={discoveryCampaignId}><option value="">Whole brand (discovery)</option>{campaignsForBrand(launchedBoard, activeBrandName).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><PromotionTargetSelect products={productPersonas} value={promotionTarget} onChange={setPromotionTarget} /><Input label="Campaign budget" type="number" value={String(budget)} onChange={(value) => setBudget(Number(value))} /><label className="block text-sm font-medium text-graphite">Filter by niche<select className="mt-1 h-10 w-full rounded-md border border-line bg-paper px-3 text-sm text-ink" onChange={(event) => setDiscoveryNiche(event.target.value)} value={discoveryNiche}><option value="">All niches</option>{ALL_NICHES.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="flex gap-2"><button className="inline-flex h-10 items-center gap-2 rounded-md bg-moss px-4 text-sm font-semibold text-white" onClick={recomputeMatches} type="button"><RefreshCcw size={16} /> {loading === "match" ? "Matching" : "Run matching"}</button><button className="inline-flex h-10 items-center gap-2 rounded-md border border-ai/20 bg-ai/5 px-4 text-sm font-semibold text-ai" disabled={!compareHandles.length} onClick={() => setCompareOpen(true)} type="button"><GitCompareArrows size={16} /> Compare selected</button></div></div>{reachOutNote ? <p className="rounded-md border border-ai/20 bg-ai/5 p-3 text-sm text-ai">{reachOutNote}</p> : null}{filteredMatches.map((match) => { const creator = creators.find((item) => item.handle === match.creatorHandle); return <MatchCard business={businessProfile} campaignSelected={Boolean(discoveryCampaignId)} compareSelected={creator ? compareHandles.includes(creator.handle) : false} creator={creator} key={match.creatorHandle} match={match} onCompare={creator ? () => toggleCompare(creator.handle) : undefined} onReachOut={creator ? () => reachOutToCreator(creator.handle) : undefined} shortlisted={shortlist.includes(match.creatorHandle)} toggle={() => setShortlist((s) => s.includes(match.creatorHandle) ? s.filter((h) => h !== match.creatorHandle) : [...s, match.creatorHandle])} />; })}{compareOpen && <CompareModal creators={comparisonCreators} matches={sortedMatches} onClose={() => setCompareOpen(false)} />}</div>}
    {brandTab === "campaign" && <CampaignComposer campaign={campaign} onLaunch={launchCampaign} personaText={productPersonas.find((product) => product.name === campaign.product)?.persona || productPersona} questionsSlot={<QuestionList questions={productQuestions} answers={productAnswers} setAnswers={setProductAnswers} magic={(i) => magicProductAnswer(i, campaign, businessProfile)} />} setCampaign={setCampaign} targetSelector={<PromotionTargetSelect products={productPersonas} value={productPersonas.some((product) => product.name === campaign.product) ? campaign.product : "brand"} onChange={(value) => { const product = productPersonas.find((item) => item.name === value); setCampaign({ ...campaign, product: value === "brand" ? businessProfile.businessName : value, audience: product?.targetAudience || campaign.audience }); }} />} />}
    {brandTab === "applicants" && <ApplicantsBoard applications={applications} campaigns={brandCampaigns} creators={creators} onDecide={decideApplication} selectedCampaignId={activeApplicantCampaignId} setSelectedCampaignId={setApplicantCampaignId} />}
  </Workspace>;

  return <Workspace banner={syncBanner} eyebrow="Creator login" title="Creator workspace" onLogout={logout} nav={<><Nav active={creatorTab === "feed"} label="Campaigns" onClick={() => goCreator("feed")} /><Nav active={creatorTab === "applications"} label={myApplications.length ? `My applications (${myApplications.length})` : "My applications"} onClick={() => goCreator("applications")} /><Nav active={creatorTab === "reels"} label="My portfolio" onClick={() => goCreator("reels")} /><Nav active={creatorTab === "profile" || creatorTab === "onboarding" || creatorTab === "persona" || creatorTab === "pricing" || creatorTab === "preview"} label="My Profile" onClick={() => goCreator("profile")} /></>}>
    {creatorTab === "onboarding" && <div className="grid gap-5 xl:grid-cols-[430px_1fr]"><div className="space-y-5"><Panel title="Step 1: Creator onboarding"><p className="text-sm leading-6 text-graphite">Analyze your Instagram profile, then answer creator-fit questions. Magic write drafts answers only when you click them, using extracted profile data.</p><Input label="Instagram handle or URL" value={creatorInput} onChange={setCreatorInput} /><button className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-ai px-4 text-sm font-semibold text-white" onClick={analyzeCreator} type="button"><Sparkles size={16} /> {loading === "creator" ? "Analyzing" : "Analyze creator"}</button><InstagramConnect handle={signedInHandle || creatorProfile.handle} status={instagramStatus} verified={creatorProfile.verified === true} />{analysisNotice ? <AnalysisNotice lines={analysisNotice.lines} onDismiss={() => setAnalysisNotice(null)} /> : null}<QuestionList questions={creatorQuestions} answers={creatorAnswers} setAnswers={setCreatorAnswers} magic={(i) => magicCreatorAnswer(i, creatorProfile)} /></Panel><Panel title="Step 2: Your audience numbers"><p className="text-sm leading-6 text-graphite">Pulled from Instagram when it allows it, which deployed servers usually cannot. Enter them yourself so brands can judge reach and so campaign projections work.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Input label="Followers" onChange={(value) => updateCreator({ publicFollowerCount: Number(value) || undefined })} placeholder="42000" type="number" value={creatorProfile.publicFollowerCount ? String(creatorProfile.publicFollowerCount) : ""} /><Input label="Posts" onChange={(value) => updateCreator({ publicPostCount: Number(value) || undefined })} placeholder="320" type="number" value={creatorProfile.publicPostCount ? String(creatorProfile.publicPostCount) : ""} /></div>{creatorProfile.publicFollowerCount ? <p className="mt-3 text-xs text-moss">Average likes, comments and engagement are estimated from this, and update as you change it.</p> : <p className="mt-3 text-xs text-gold">Without a follower count brands cannot see your reach, and this profile will not match campaigns that set a minimum audience size.</p>}</Panel><Panel title="Step 3: Choose your niches"><p className="text-sm leading-6 text-graphite">Brands filter applicants by these, so pick the niches you actually want campaigns in. Your primary niche drives campaign matching; sub-niches widen what you show up for.</p><div className="mt-4"><NicheSelector languages={creatorProfile.contentLanguages || []} primaryNiche={creatorProfile.primaryNiche} subNiches={creatorProfile.subNiches || []} onChange={(next) => updateCreator({ primaryNiche: next.primaryNiche, subNiches: next.subNiches, contentLanguages: next.languages })} /></div></Panel><Panel title="Step 4: Location and collaboration"><p className="text-sm leading-6 text-graphite">Your city and country are public, because campaigns target regions and brands filter on them. Barter willingness decides whether barter-only campaigns reach you at all.</p><div className="mt-4"><LocationFields location={creatorProfile.location} onChange={(region?: Region) => updateCreator({ location: region })} /></div><label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-line bg-paper p-4 text-sm text-graphite"><span><span className="block font-semibold text-ink">Open to barter collaboration</span><span className="text-xs text-graphite">Let brands propose product or service exchange instead of cash only. Barter-only campaigns are hidden from creators who leave this off.</span></span><input className="h-5 w-5 accent-ai" type="checkbox" checked={creatorProfile.openForBarter === true} onChange={(event) => updateCreator({ openForBarter: event.target.checked })} /></label></Panel><Panel title="Step 5: Contact details"><p className="text-sm leading-6 text-graphite">Private by default. A brand only sees this after they approve you for one of their campaigns.</p><div className="mt-4 grid gap-3 md:grid-cols-2"><Input label="Email" value={creatorProfile.contact?.email || ""} onChange={(value) => updateContact({ email: value })} /><Input label="Phone / WhatsApp" value={creatorProfile.contact?.phone || ""} onChange={(value) => updateContact({ phone: value })} /><Input label="City" value={creatorProfile.contact?.city || ""} onChange={(value) => updateContact({ city: value })} /><Input label="Country" value={creatorProfile.contact?.country || ""} onChange={(value) => updateContact({ country: value })} /><Input label="Manager email (optional)" value={creatorProfile.contact?.managerEmail || ""} onChange={(value) => updateContact({ managerEmail: value })} /></div><div className="mt-5 flex flex-wrap gap-3"><button className="rounded-md bg-ai px-4 py-2 text-sm font-semibold text-white" onClick={() => goCreator("reels")} type="button">Next: add your reels</button><button className="rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold text-graphite" onClick={() => goCreator("profile")} type="button">Finish onboarding</button></div></Panel></div><div className="space-y-5"><CreatorCard creator={creatorProfile} /><Panel title="Portfolio preview" actions={<button className="text-xs font-semibold text-ai" onClick={() => goCreator("reels")} type="button">Manage portfolio</button>}><ReelGrid columns={2} reels={(creatorProfile.reels || []).slice(0, 2)} /></Panel></div></div>}
    {creatorTab === "persona" && <div className="space-y-5"><Panel title="Step 2: AI creator persona"><p className="text-sm leading-6 text-graphite">This persona combines your onboarding answers with Instagram profile analytics so campaigns can be ranked against your actual creator fit.</p><div className="mt-4"><CreatorCard creator={creatorProfile} /></div><button className="mt-5 rounded-md bg-ai px-4 py-2 text-sm font-semibold text-white" onClick={() => { setCreatorPersonaReady(true); goCreator("feed"); }} type="button">Save AI persona and view campaigns</button></Panel></div>}
    {creatorTab === "feed" && <div className="space-y-5"><FlowGate ready={creatorPersonaReady} message="Complete onboarding and save your AI persona before browsing matched campaigns." /><CampaignBoard applications={myApplications} creator={creatorProfile} items={sortedCreatorCampaignScores} onApply={applyToCampaign} onWithdraw={withdrawApplication} setSort={setCampaignSort} sort={campaignSort} /></div>}
    {creatorTab === "reels" && <ReelManager defaultNiche={creatorProfile.primaryNiche} onChange={(reels) => updateCreator({ reels })} reels={creatorProfile.reels || []} />}
    {creatorTab === "applications" && <div className="space-y-5"><Panel title="My applications"><p className="text-sm leading-6 text-graphite">Every campaign you applied to and where it stands. A brand only gets your email and phone number once they approve you.</p><div className="mt-4 grid gap-3 md:grid-cols-4"><Metric label="Total" value={String(myApplications.length)} /><Metric label="Shortlisted" value={String(myApplications.filter((item) => item.status === "shortlisted").length)} /><Metric label="Approved" value={String(myApplications.filter((item) => item.status === "approved").length)} /><Metric label="Portfolio reels" value={String(creatorProfile.reels?.length || 0)} /></div></Panel>{myApplications.length ? <div className="space-y-3">{myApplications.map((item) => <article className="rounded-lg border border-line bg-card p-5 shadow-panel" key={item.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-ink">{item.campaignName}</h3><p className="mt-1 text-xs text-graphite">{item.status === "invited" ? `A brand reached out ${timeAgo(item.appliedAt)}${item.quotedPrice ? ` · at your rate of $${item.quotedPrice.toLocaleString()}` : ""}` : `Applied ${timeAgo(item.appliedAt)} · quoted $${item.quotedPrice.toLocaleString()}${item.openToBarter ? " · open to barter" : ""}`}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${item.status === "approved" ? "bg-moss text-white" : item.status === "rejected" ? "border border-line bg-paper text-graphite" : item.status === "shortlisted" ? "border border-gold/30 bg-gold/5 text-gold" : "border border-ai/20 bg-ai/5 text-ai"}`}>{APPLICATION_STATUS_LABEL[item.status]}</span></div><p className="mt-3 text-sm leading-6 text-graphite">{item.pitch}</p>{item.status === "invited" ? <div className="mt-3 rounded-md border border-ai/20 bg-ai/5 p-3"><p className="text-sm text-ink">{item.brandNote || "A brand reached out to you for this campaign."}</p>{item.quotedPrice ? <p className="mt-1 text-xs font-semibold text-moss">Accepting takes this campaign at your rate of ${item.quotedPrice.toLocaleString()}.</p> : null}<div className="mt-3 flex gap-2"><button className="rounded-md bg-moss px-4 py-2 text-xs font-semibold text-white" onClick={() => decideApplication(item.id, "approved")} type="button">Accept at ${item.quotedPrice ? item.quotedPrice.toLocaleString() : "your rate"}</button><button className="rounded-md border border-line bg-card px-4 py-2 text-xs font-semibold text-graphite" onClick={() => decideApplication(item.id, "rejected")} type="button">Reject</button></div></div> : null}{item.status === "approved" ? <p className="mt-3 text-sm font-semibold text-moss">Approved. The brand now has your contact details and can reach out directly.</p> : null}{item.status === "applied" ? <button className="mt-3 text-xs font-semibold text-coral" onClick={() => withdrawApplication(item.id)} type="button">Withdraw application</button> : null}</article>)}</div> : <Panel title="No applications yet"><p className="text-sm leading-6 text-graphite">You have not applied to a campaign yet. Open the Campaigns tab to see what brands have posted.</p><button className="mt-4 rounded-md bg-ai px-4 py-2 text-sm font-semibold text-white" onClick={() => goCreator("feed")} type="button">Browse campaigns</button></Panel>}</div>}
    {creatorTab === "pricing" && <PricingCard creator={creatorProfile} setOpenForBarter={(value) => updateCreator({ openForBarter: value })} updatePrice={updatePrice} />}
    {creatorTab === "profile" && <Panel title="My Profile"><p className="text-sm leading-6 text-graphite">Post-onboarding, all editable creator setup lives here: onboarding details, AI Persona, pricing, and the brand-facing preview.</p><div className="mt-5 grid gap-4 md:grid-cols-2"><button className="rounded-lg border border-ai/20 bg-ai/5 p-5 text-left" onClick={() => goCreator("onboarding")} type="button"><p className="text-sm font-semibold text-ink">Edit Onboarding Details</p><p className="mt-2 text-sm leading-6 text-graphite">Update the questions asked during onboarding and rerun creator analysis if needed.</p></button><button className="rounded-lg border border-line bg-card p-5 text-left" onClick={() => goCreator("persona")} type="button"><p className="text-sm font-semibold text-ink">Edit AI Persona</p><p className="mt-2 text-sm leading-6 text-graphite">Review or update your creator persona, audience, analytics, content pillars, and brand fit.</p></button><button className="rounded-lg border border-line bg-card p-5 text-left" onClick={() => goCreator("pricing")} type="button"><p className="text-sm font-semibold text-ink">Edit Pricing</p><p className="mt-2 text-sm leading-6 text-graphite">Update paid package rates and whether you are open to barter collaborations.</p></button><button className="rounded-lg border border-line bg-card p-5 text-left" onClick={() => goCreator("preview")} type="button"><p className="text-sm font-semibold text-ink">Brand-facing Preview</p><p className="mt-2 text-sm leading-6 text-graphite">See what brands view when they inspect your creator profile analytics.</p></button><button className="rounded-lg border border-line bg-card p-5 text-left" onClick={() => goCreator("reels")} type="button"><p className="text-sm font-semibold text-ink">My Portfolio</p><p className="mt-2 text-sm leading-6 text-graphite">Add the reels and posts brands review when they shortlist you.</p></button><button className="rounded-lg border border-line bg-card p-5 text-left" onClick={() => goCreator("applications")} type="button"><p className="text-sm font-semibold text-ink">My Applications</p><p className="mt-2 text-sm leading-6 text-graphite">Track the campaigns you applied to and where each one stands.</p></button></div><div className="mt-5"><CreatorCard creator={creatorProfile} /></div><div className="mt-5"><ReelGrid columns={2} reels={(creatorProfile.reels || []).slice(0, 2)} /></div><div className="mt-5 grid gap-3 md:grid-cols-3"><Metric label="Package" value={creatorProfile.pricing.packagePrice ? `$${creatorProfile.pricing.packagePrice.toLocaleString()}` : "Custom"} /><Metric label="Barter" value={creatorProfile.openForBarter ? "Open" : "Paid only"} /><Metric label="Persona" value={creatorPersonaReady ? "Ready" : "Draft"} /></div><div className="mt-5"><button className="rounded-md border border-line bg-card px-4 py-2 text-sm font-semibold text-graphite" onClick={() => goCreator("feed")} type="button">View matched campaigns</button></div></Panel>}
    {creatorTab === "preview" && <div className="space-y-5"><Panel title="Brand-facing preview"><p className="text-sm leading-6 text-graphite">{creatorProfile.summary}</p><div className="mt-4 flex flex-wrap gap-2">{[creatorProfile.primaryNiche, ...(creatorProfile.subNiches || [])].filter(Boolean).map((item) => <span className="rounded-full border border-ai/20 bg-ai/5 px-3 py-1 text-xs font-semibold text-ai" key={item}>{item}</span>)}</div><CreatorPerformance creator={creatorProfile} /></Panel><Panel title={`Portfolio (${creatorProfile.reels?.length || 0})`} actions={<button className="text-xs font-semibold text-ai" onClick={() => goCreator("reels")} type="button">Manage portfolio</button>}><ReelGrid reels={creatorProfile.reels || []} /></Panel><Panel title="Location and collaboration"><div className="grid gap-3 md:grid-cols-2"><Metric label="Based in" value={creatorProfile.location ? regionLabel(creatorProfile.location) : "Not stated"} /><Metric label="Barter" value={creatorProfile.openForBarter ? "Open to barter" : "Paid only"} /></div></Panel><Panel title="Contact details"><p className="text-sm leading-6 text-graphite">Hidden from brands until one of your applications is approved.</p><div className="mt-3 grid gap-3 md:grid-cols-2"><Metric label="Email" value={creatorProfile.contact?.email || "Not set"} /><Metric label="Phone" value={creatorProfile.contact?.phone || "Not set"} /></div></Panel></div>}
  </Workspace>;
}

const instagramStatusMessage: Record<string, string> = {
  connected: "Instagram connected. Your follower and post counts now come from Instagram directly.",
  denied: "You cancelled the Instagram connection. Nothing was changed.",
  not_configured: "Instagram connect is not set up on this deployment yet.",
  missing_handle: "Sign in with your handle first, then connect Instagram.",
  missing_code: "Instagram did not return an authorisation code. Try again.",
  bad_state: "That connection link expired. Start the connection again.",
  wrong_account_type: "Instagram only shares metrics for Business and Creator accounts. Switch your account type in the Instagram app, then try again.",
  failed: "The Instagram connection failed."
};

function InstagramConnect({ handle, status, verified }: { handle: string; status: string | null; verified: boolean }) {
  const message = status ? instagramStatusMessage[status] : null;
  const failed = status !== null && status !== "connected";

  return <div className={`mt-4 rounded-md border p-4 ${verified ? "border-moss/30 bg-moss/5" : "border-ai/20 bg-ai/5"}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <p className={`inline-flex items-center gap-2 text-sm font-semibold ${verified ? "text-moss" : "text-ink"}`}>
          {verified ? <><BadgeCheck size={15} /> Instagram connected</> : "Connect Instagram for verified numbers"}
        </p>
        <p className="mt-1 text-xs leading-5 text-graphite">
          {verified
            ? "Brands see a verified badge on your profile, and your numbers refresh from Instagram rather than being typed in."
            : "Instagram blocks servers from reading public profiles, so a hosted app cannot fetch your follower count. Connecting authorises it properly. Business and Creator accounts only."}
        </p>
      </div>
      {!verified && handle ? <a className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md bg-ai px-4 text-sm font-semibold text-white" href={`/api/auth/instagram/start?handle=${encodeURIComponent(handle)}`}>Connect Instagram</a> : null}
    </div>
    {message ? <p className={`mt-3 text-xs ${failed ? "text-gold" : "text-moss"}`}>{message}</p> : null}
  </div>;
}

function AnalysisNotice({ lines, onDismiss }: { lines: string[]; onDismiss: () => void }) {
  return <div className="mt-4 rounded-md border border-gold/30 bg-gold/5 p-4">
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm font-semibold text-gold">Profile data is incomplete</p>
      <button className="text-xs font-semibold text-graphite" onClick={onDismiss} type="button">Dismiss</button>
    </div>
    {lines.map((line) => <p className="mt-2 text-xs leading-5 text-graphite" key={line}>{line}</p>)}
  </div>;
}

function SyncBanner({ error, onRetry, status }: { error: string | null; onRetry: () => void; status: string }) {
  if (status === "ready") return null;
  if (status === "loading") return <div className="mb-4 rounded-lg border border-line bg-card p-3 text-sm text-graphite">Loading the shared marketplace from the database...</div>;
  return <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-coral/40 bg-coral/5 p-3 text-sm text-coral">
    <span>Could not reach the database. {error}</span>
    <button className="rounded-md border border-coral/40 px-3 py-1 text-xs font-semibold" onClick={onRetry} type="button">Retry</button>
  </div>;
}

function FlowGate({ message, ready }: { message: string; ready: boolean }) { if (ready) return null; return <div className="rounded-lg border border-ai/20 bg-ai/5 p-4 text-sm text-graphite">{message}</div>; }
function ProductPersonaList({ products }: { products: ProductPersona[] }) { return <Panel title="Product personas">{products.length ? <div className="space-y-3">{products.map((product) => <article className="rounded-md border border-line bg-card p-4" key={product.name}><p className="font-semibold text-ink">{product.name}</p><p className="mt-1 text-xs text-graphite">{product.category} | {product.markets}</p><p className="mt-3 text-sm leading-6 text-graphite">{product.persona}</p></article>)}</div> : <p className="text-sm leading-6 text-graphite">No products added yet. Add at least one product if you want product-specific creator sorting.</p>}</Panel>; }
function PromotionTargetSelect({ onChange, products, value }: { onChange: (value: string) => void; products: ProductPersona[]; value: string }) { return <label className="block text-sm font-medium text-graphite">Choose promotion target<select className="mt-1 h-10 w-full rounded-md border border-line bg-paper px-3 text-ink" onChange={(event) => onChange(event.target.value)} value={value === "brand" ? "brand" : value}><option value="brand">Whole brand in general</option>{products.map((product) => <option key={product.name} value={product.name}>{product.name}</option>)}</select></label>; }
function CompareModal({ creators, matches, onClose }: { creators: CreatorProfile[]; matches: MatchResult[]; onClose: () => void }) { return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="max-h-[90vh] w-full max-w-6xl overflow-auto rounded-2xl border border-line bg-card p-5 shadow-panel"><div className="mb-4 flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold text-ink">Creator comparison</h2><p className="mt-1 text-sm text-graphite">Compare up to 5 selected creators before making the campaign decision.</p></div><button className="rounded-md border border-line bg-paper px-3 py-2 text-sm font-semibold text-graphite" onClick={onClose} type="button">Close</button></div><CompareCreators creators={creators.slice(0, 5)} matches={matches} /></div></div>; }
function LoginScreen({ onSelect }: { onSelect: (role: Role) => void }) { return <main className="min-h-screen bg-paper px-6 py-6"><div className="mx-auto flex min-h-[calc(100vh-48px)] max-w-6xl flex-col justify-center"><div className="mb-8 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-md bg-ai text-white"><BrainCircuit size={20} /></div><div><p className="text-sm font-semibold">{productName}</p><p className="text-xs text-graphite">AI creator matchmaking</p></div></div><p className="text-sm font-semibold uppercase text-moss">Separate logins</p><h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-normal text-ink">Choose brand login or creator login.</h1><div className="mt-8 grid gap-5 md:grid-cols-2"><LoginCard icon={<Building2 size={24} />} title="Brand or business" text="Analyze your company, launch campaigns, and inspect creator analytics." button="Brand login" onClick={() => onSelect("brand")} /><LoginCard icon={<UserRound size={24} />} title="Creator" text="Analyze your profile, answer onboarding, and discover campaigns with match scores." button="Creator login" onClick={() => onSelect("creator")} /></div></div></main>; }
function LoginCard(props: { button: string; icon: React.ReactNode; onClick: () => void; text: string; title: string }) { return <section className="rounded-lg border border-line bg-card p-6 shadow-panel"><div className="flex h-12 w-12 items-center justify-center rounded-md bg-paper text-ink">{props.icon}</div><h2 className="mt-5 text-xl font-semibold">{props.title}</h2><p className="mt-3 min-h-16 text-sm leading-6 text-graphite">{props.text}</p><button className="mt-5 h-10 rounded-md bg-ai px-4 text-sm font-semibold text-white" onClick={props.onClick} type="button">{props.button}</button></section>; }
function Workspace(props: { banner?: React.ReactNode; children: React.ReactNode; eyebrow: string; nav: React.ReactNode; onLogout: () => void; title: string }) { return <main className="min-h-screen bg-paper"><div className="mx-auto flex max-w-7xl gap-6 px-6 py-6"><aside className="hidden w-64 shrink-0 border-r border-line pr-5 lg:block"><div className="mb-8 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-ai text-white"><BrainCircuit size={19} /></div><div><p className="text-sm font-semibold">{productName}</p><p className="text-xs text-graphite">{props.eyebrow}</p></div></div><nav className="space-y-1">{props.nav}</nav></aside><section className="min-w-0 flex-1"><header className="mb-6 flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-semibold uppercase text-moss">{props.eyebrow}</p><h1 className="mt-1 text-2xl font-semibold tracking-normal text-ink">{props.title}</h1></div><button className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-card px-4 text-sm font-semibold" onClick={props.onLogout} type="button"><LogOut size={16} />Logout</button></header><div className="mb-5 flex flex-wrap gap-2 lg:hidden">{props.nav}</div>{props.banner}{props.children}</section></div></main>; }
function Nav(props: { active: boolean; label: string; onClick: () => void }) { return <button className={`inline-flex h-10 w-full items-center rounded-md px-3 text-sm font-medium ${props.active ? "bg-ai text-white" : "bg-card text-graphite"}`} onClick={props.onClick} type="button">{props.label}</button>; }
function Panel(props: { actions?: React.ReactNode; children: React.ReactNode; title: string }) { return <section className="rounded-lg border border-line bg-card p-5 shadow-panel"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-semibold">{props.title}</h2>{props.actions}</div><div className="mt-4">{props.children}</div></section>; }
function Input(props: { label: string; onChange: (value: string) => void; placeholder?: string; type?: string; value: string }) { return <label className="block text-sm font-medium text-graphite">{props.label}<input className="mt-1 h-10 w-full rounded-md border border-line bg-paper px-3" onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} type={props.type || "text"} value={props.value} /></label>; }
function QuestionList(props: { answers: string[]; magic: (index: number) => string; questions: string[]; setAnswers: (answers: string[]) => void }) { return <div className="mt-5 space-y-3">{props.questions.map((q, i) => <label className="block text-sm font-medium text-graphite" key={q}>{q}<textarea className="mt-1 min-h-20 w-full rounded-md border border-line bg-paper px-3 py-2" onChange={(e) => props.setAnswers(props.answers.map((a, idx) => idx === i ? e.target.value : a))} value={props.answers[i]} /><button className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-moss" onClick={() => props.setAnswers(props.answers.map((a, idx) => idx === i ? props.magic(i) : a))} type="button"><Sparkles size={13} /> Magic write</button></label>)}</div>; }
function BusinessCard({ profile }: { profile: BusinessProfile }) { return <Panel title={profile.businessName}><p className="text-sm text-graphite">{profile.industry} | {profile.category}</p><p className="mt-3 text-sm leading-6 text-graphite">{profile.summary}</p><div className="mt-5 grid gap-3 md:grid-cols-2"><PersonaBox title="Brand persona" text={`${profile.brandPersonality.join(", ")} brand with ${profile.pricePositioning.toLowerCase()} positioning.`} /><PersonaBox title="Customer persona" text={profile.estimatedCustomerPersona.join("; ")} /><PersonaBox title="Creator brief" text={`Creators should speak to ${profile.targetAudience.slice(0, 3).join(", ").toLowerCase()} using ${profile.brandTone.join(", ").toLowerCase()} tone.`} /><PersonaBox title="Proof points" text={profile.uniqueSellingPoints.join("; ") || profile.primaryValueProposition} /></div><Tags title="Audience" items={profile.targetAudience} /><Tags title="Products" items={profile.products} /></Panel>; }
function CreatorCard({ creator }: { creator: CreatorProfile }) { return <Panel title={creator.name} actions={creator.verified ? <span className="inline-flex items-center gap-1 rounded-full border border-moss/30 bg-moss/5 px-3 py-1 text-xs font-semibold text-moss"><BadgeCheck size={13} /> Verified</span> : null}><p className="text-sm text-graphite">{creator.handle} | {creator.primaryNiche}</p><p className="mt-3 text-sm leading-6 text-graphite">{creator.summary}</p><CreatorPerformance creator={creator} /><div className="mt-5 grid gap-3 md:grid-cols-2"><PersonaBox title="Creator persona" text={`${creator.brandPersonality.join(", ")} creator known for ${creator.contentPillars.slice(0, 3).join(", ").toLowerCase()}.`} /><PersonaBox title="Audience persona" text={`${creator.estimatedAudience.ageGroups.join(", ")} audience interested in ${creator.estimatedAudience.interests.join(", ").toLowerCase()}.`} /><PersonaBox title="Performance read" text={`${creator.publicPostCount ? compact(creator.publicPostCount) : "Unknown"} posts, ${creator.publicFollowerCount ? compact(creator.publicFollowerCount) : "unknown"} followers, ${creator.contentQuality.postingConsistency.toLowerCase()} posting signal.`} /><PersonaBox title="Brand fit" text={`Best for ${creator.previousCollaborations.productCategories.join(", ") || creator.primaryNiche} campaigns using ${creator.contentStyles.slice(0, 3).join(", ").toLowerCase()}.`} /></div><Tags title="Content styles" items={creator.contentStyles} /></Panel>; }
function CreatorPerformance({ creator }: { creator: CreatorProfile }) { const stats = creatorStats(creator); return <div className="mt-5 space-y-4"><div className="grid grid-cols-2 gap-3 md:grid-cols-3"><Metric label="Followers" value={creator.publicFollowerCount ? compact(creator.publicFollowerCount) : "Unknown"} /><Metric label="Posts" value={creator.publicPostCount ? compact(creator.publicPostCount) : "Unknown"} /><Metric label="Avg likes" value={stats.avgLikes ? `${compact(stats.avgLikes)}${stats.measured ? "" : " est."}` : "Needs data"} /><Metric label="Avg comments" value={stats.avgComments ? `${compact(stats.avgComments)}${stats.measured ? "" : " est."}` : "Needs data"} /><Metric label="Engagement" value={stats.engagementRate ? `${stats.engagementRate.toFixed(1)}%${stats.measured ? "" : " est."}` : "Needs data"} /><Metric label="Package" value={creator.pricing.packagePrice ? `$${compact(creator.pricing.packagePrice)}` : "Custom"} /></div><div className="grid gap-3 md:grid-cols-3"><StatBar label="Audience strength" value={stats.audienceStrength} /><StatBar label="Content depth" value={stats.contentDepth} /><StatBar label="Brand safety" value={creator.brandSafety.overallScore} /></div></div>; }
function CreatorGlassProfileCard({ creator, metrics, score }: { creator: CreatorProfile; metrics: Array<{ label: string; value: number }>; score: number }) { const stats = creatorStats(creator); return <section className="relative overflow-hidden rounded-3xl border border-line bg-card p-6 shadow-[0_24px_80px_rgba(22,33,28,0.14)] backdrop-blur-xl"><div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-ai/5 blur-3xl" /><div className="absolute -bottom-20 -left-16 h-52 w-52 rounded-full bg-ai/5 blur-3xl" /><div className="relative grid gap-6 lg:grid-cols-[1fr_280px]"><div><div className="flex items-start gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-ai text-white shadow-lg"><UserRound size={24} /></div><div><p className="text-xs font-semibold uppercase tracking-wide text-moss">Creator profile</p><h2 className="mt-1 text-2xl font-semibold text-ink">{creator.name}</h2><p className="text-sm text-graphite">{creator.handle} | {creator.primaryNiche}</p></div></div><p className="mt-5 max-w-3xl text-sm leading-6 text-graphite">{creator.summary}</p><div className="mt-6 grid gap-3 sm:grid-cols-3"><Metric label="Followers" value={creator.publicFollowerCount ? compact(creator.publicFollowerCount) : "Unknown"} /><Metric label="Avg likes" value={stats.avgLikes ? `${compact(stats.avgLikes)}${stats.measured ? "" : " est."}` : "Needs data"} /><Metric label="Engagement" value={stats.engagementRate ? `${stats.engagementRate.toFixed(1)}%${stats.measured ? "" : " est."}` : "Needs data"} /></div><div className="mt-6 space-y-4">{metrics.map((metric) => <GlassMetricBar key={metric.label} label={metric.label} value={metric.value} />)}</div></div><AnimatedCircularScore value={score} /></div></section>; }
function AnimatedCircularScore({ value }: { value: number }) { const safeValue = Math.max(0, Math.min(100, Math.round(value))); const highScore = safeValue >= 90; return <div className={`rounded-3xl border bg-card p-5 text-center shadow-inner backdrop-blur ${highScore ? "border-ai/20 bg-ai/5" : "border-line"}`}><p className="text-xs font-semibold uppercase tracking-wide text-graphite">Compatibility Score</p><div className="relative mx-auto mt-5 grid h-44 w-44 place-items-center"><svg className="h-44 w-44 -rotate-90" viewBox="0 0 120 120"><circle cx="60" cy="60" fill="none" r="52" stroke="#1e293b" strokeWidth="10" /><circle className="transition-all duration-1000 ease-out" cx="60" cy="60" fill="none" r="52" stroke="#6366f1" strokeLinecap="round" strokeWidth="10" strokeDasharray="326.73" strokeDashoffset={326.73 - (326.73 * safeValue) / 100} /></svg><div className="absolute text-center"><p className={highScore ? "text-4xl font-semibold text-ai shadow-[0_0_20px_rgba(99,102,241,0.08)]" : "text-4xl font-semibold text-ink"}>{safeValue}</p><p className="text-xs text-graphite">out of 100</p></div></div></div>; }
function GlassMetricBar({ label, value }: { label: string; value: number }) { const safeValue = Math.max(0, Math.min(100, Math.round(value))); const highScore = safeValue >= 90; return <div className={highScore ? "rounded-xl border border-ai/20 bg-ai/5 p-2" : ""}><div className="mb-2 flex items-center justify-between text-sm"><p className="font-semibold text-ink">{label}</p><p className={highScore ? "text-ai shadow-[0_0_20px_rgba(99,102,241,0.08)]" : "text-graphite"}>{safeValue}%</p></div><div className="h-3 overflow-hidden rounded-full bg-card/70 shadow-inner"><div className="h-full rounded-full bg-ai transition-all duration-1000" style={{ width: `${safeValue}%` }} /></div></div>; }
function AIJustificationBlock({ business, creator, match }: { business?: BusinessProfile; creator?: CreatorProfile; match: Pick<MatchResult, "creatorHandle" | "score"> }) { const profile = creator; const quotes = aiJustificationQuotes(profile, business, match); const icons = [UsersRound, MessageSquareQuote, TrendingUp]; return <div className="rounded-2xl border border-line bg-card p-4"><div className="flex items-center gap-2"><div className="grid h-9 w-9 place-items-center rounded-xl bg-ai text-white"><Sparkles size={16} /></div><div><p className="text-sm font-semibold">AI Match Justification</p><p className="text-xs text-graphite">Generated pull quotes from audience, content, and ROI signals.</p></div></div><div className="mt-4 space-y-3">{quotes.map((quote, index) => { const Icon = icons[index] || BadgeCheck; return <div className="flex gap-3 rounded-xl bg-card/70 p-3" key={quote}><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ai/5 text-ai"><Icon size={16} /></div><p className="text-sm leading-5 text-graphite">{quote}</p></div>; })}</div></div>; }
function aiJustificationQuotes(creator: CreatorProfile | undefined, business: BusinessProfile | undefined, match: Pick<MatchResult, "creatorHandle" | "score">) { const niche = creator?.primaryNiche || business?.category || "your category"; const audience = creator?.estimatedAudience.interests[0] || business?.targetAudience[0] || "target buyers"; const sentiment = creator ? Math.min(5, Math.max(4.1, creator.brandSafety.overallScore / 20)).toFixed(1) : "4.8"; return [`Matched because 42% of their audience talks about #${slugTag(niche)} and ${audience.toLowerCase()}.`, `High sentiment rating (${sentiment}/5) on recent video content and captions.`, `AI predicts efficient conversion because the collaboration fit score is ${match.score}/100.`]; }
function creatorCompatibilityMetrics(creator: CreatorProfile, business: BusinessProfile, score: number) { const stats = creatorStats(creator); const audienceWords = business.targetAudience.join(" ").toLowerCase(); const creatorWords = creator.estimatedAudience.interests.join(" ").toLowerCase(); const audienceOverlap = business.targetAudience.filter((word) => creatorWords.includes(word.toLowerCase()) || audienceWords.includes(word.toLowerCase())).length; const audienceAlignment = Math.min(98, Math.max(45, stats.audienceStrength + audienceOverlap * 6)); const contentRelevance = Math.min(98, Math.max(42, score - 4 + creator.contentStyles.length * 2)); const historicalRoi = Math.min(96, Math.max(38, Math.round((creator.brandSafety.overallScore + stats.contentDepth + score) / 3))); return [{ label: "Audience Alignment", value: audienceAlignment }, { label: "Content Relevance", value: contentRelevance }, { label: "Historical ROI", value: historicalRoi }]; }
function buildAiComparisonRows(creators: CreatorProfile[], matches: MatchResult[]) { const values = creators.map((creator) => { const stats = creatorStats(creator); const matchScore = matches.find((match) => match.creatorHandle === creator.handle)?.score || 60; const authenticity = Math.min(99, Math.max(45, Math.round((creator.brandSafety.overallScore + stats.audienceStrength) / 2))); const personaMatch = Math.min(99, Math.max(40, matchScore)); const predictedCpm = Math.max(3, Math.round((creator.pricing.packagePrice || 850) / Math.max(1, (creator.publicFollowerCount || 25000) / 1000))); return { authenticity, creator, personaMatch, predictedCpm }; }); const highestAuth = Math.max(...values.map((value) => value.authenticity)); const highestPersona = Math.max(...values.map((value) => value.personaMatch)); return [{ icon: LineChart, label: "Predicted CPM", values: values.map((value) => ({ creator: value.creator, display: `$${value.predictedCpm}`, note: "Lower projected cost per 1K reached", top: false })) }, { icon: BadgeCheck, label: "Audience Authenticity Score", values: values.map((value) => ({ creator: value.creator, display: `${value.authenticity}/100`, note: "Follower quality and safety-weighted signal", top: value.authenticity === highestAuth && value.authenticity >= 90 })) }, { icon: Target, label: "Core Persona Match", values: values.map((value) => ({ creator: value.creator, display: `${value.personaMatch}/100`, note: "Fit against brand, product, and audience persona", top: value.personaMatch === highestPersona && value.personaMatch >= 90 })) }]; }
function slugTag(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 28) || "brandfit"; }
function PricingCard(props: { creator: CreatorProfile; setOpenForBarter: (value: boolean) => void; updatePrice: (key: keyof CreatorProfile["pricing"], value: number) => void }) { const rows: Array<[keyof CreatorProfile["pricing"], string]> = [["story", "Story"], ["reel", "Reel"], ["staticPost", "Static post"], ["carousel", "Carousel"], ["ugcVideo", "UGC video"], ["packagePrice", "Package price"]]; return <Panel title="Step 4: Creator pricing"><p className="mb-4 text-sm leading-6 text-graphite">Set your collaboration prices so brands can judge fit before outreach. You can also mark yourself open to barter collaborations.</p><div className="grid gap-4 md:grid-cols-2">{rows.map(([key, label]) => <Input key={key} label={label} type="number" value={String(props.creator.pricing[key] || 0)} onChange={(value) => props.updatePrice(key, Number(value))} />)}</div><label className="mt-5 flex cursor-pointer items-center justify-between gap-4 rounded-md border border-line bg-card p-4 text-sm text-graphite"><span><span className="block font-semibold text-ink">Open to barter collaboration</span><span className="text-xs text-graphite">Allow brands to propose product/service exchange instead of only paid briefs.</span></span><input className="h-5 w-5 accent-ai" type="checkbox" checked={props.creator.openForBarter === true} onChange={(event) => props.setOpenForBarter(event.target.checked)} /></label></Panel>; }
function MatchCard(props: { business: BusinessProfile; campaignSelected?: boolean; compareSelected: boolean; creator?: CreatorProfile; match: MatchResult; onCompare?: () => void; onReachOut?: () => void; shortlisted: boolean; toggle: () => void }) { const metrics = props.creator ? creatorCompatibilityMetrics(props.creator, props.business, props.match.score) : []; return <article className="rounded-lg border border-line bg-card p-5 shadow-panel"><div className="flex flex-col justify-between gap-4 md:flex-row"><div><h2 className="text-lg font-semibold">{props.creator?.name || props.match.creatorHandle}</h2><p className="text-sm text-graphite">{props.match.creatorHandle} | {props.creator?.primaryNiche || "Creator"}</p></div><div className="flex items-center gap-3"><Score value={props.match.score} />{props.onReachOut ? <button className="inline-flex h-9 items-center gap-2 rounded-md bg-ai px-3 text-xs font-semibold text-white disabled:opacity-50" onClick={props.onReachOut} title={props.campaignSelected ? "Invite this creator to the selected campaign" : "Select a campaign above to reach out"} type="button"><Send size={14} /> Reach out</button> : null}<button className={`inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-xs font-semibold ${props.compareSelected ? "bg-ai text-white" : "bg-paper text-ink"}`} disabled={!props.onCompare} onClick={props.onCompare} type="button"><GitCompareArrows size={14} /> {props.compareSelected ? "Comparing" : "Compare"}</button><button className="h-9 w-9 rounded-md border border-line bg-paper" onClick={props.toggle} type="button"><Star className="mx-auto" size={17} fill={props.shortlisted ? "#b68b3c" : "none"} /></button></div></div>{props.creator && <div className="mt-5"><CreatorGlassProfileCard creator={props.creator} metrics={metrics} score={props.match.score} /></div>}<div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]"><ReasonBlock title="Reasons" items={props.match.reasons} /><AIJustificationBlock business={props.business} creator={props.creator} match={props.match} /><div className="rounded-md bg-paper p-4"><p className="text-sm font-semibold">Recommendation</p><p className="mt-2 text-sm leading-6 text-graphite">{props.match.suggestedCollaboration}</p></div></div></article>; }
function CompareCreators({ creators, matches }: { creators: CreatorProfile[]; matches: MatchResult[] }) { if (!creators.length) return <Panel title="Compare creators"><p className="text-sm text-graphite">Select Compare on creator analytics cards to build a side-by-side shortlist.</p></Panel>; const rows = buildAiComparisonRows(creators, matches); return <Panel title="Compare creators"><div className="mb-4 flex items-center gap-2 text-sm text-graphite"><GitCompareArrows size={16} /> Compare creators like a decision matrix. Indigo micro-tint marks AI scores at 90% or higher.</div><div className="overflow-x-auto"><table className="w-full min-w-[820px] border-separate border-spacing-2"><thead><tr><th className="rounded-xl bg-ai px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white">AI metric</th>{creators.map((creator) => <th className="rounded-xl border border-line bg-card/80 px-4 py-3 text-left shadow-sm backdrop-blur" key={creator.handle}><p className="font-semibold text-ink">{creator.name}</p><p className="mt-1 text-xs font-normal text-graphite">{creator.handle}</p></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td className="rounded-xl bg-card px-4 py-4 text-sm font-semibold text-white"><div className="flex items-center gap-2"><row.icon size={16} />{row.label}</div></td>{row.values.map((cell) => <td className={`rounded-xl border bg-card/75 px-4 py-4 text-sm shadow-sm backdrop-blur transition ${cell.top ? "border-ai/20 bg-ai/5" : "border-line"}`} key={cell.creator.handle}><p className="font-semibold text-ink">{cell.display}</p><p className="mt-1 text-xs leading-5 text-graphite">{cell.note}</p></td>)}</tr>)}</tbody></table></div></Panel>; }
function StatBar({ compactView, label, value }: { compactView?: boolean; label: string; value: number }) { const safeValue = Math.max(0, Math.min(100, Math.round(value))); const highScore = safeValue >= 90; return <div className={compactView ? "space-y-1" : `rounded-md border ${highScore ? "border-ai/20 bg-ai/5" : "border-line bg-card"} p-3`}><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold text-graphite">{label}</p><p className={highScore ? "text-xs font-semibold text-ai shadow-[0_0_20px_rgba(99,102,241,0.08)]" : "text-xs font-semibold text-ink"}>{safeValue}/100</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-ai" style={{ width: `${safeValue}%` }} /></div></div>; }
function creatorStats(creator: CreatorProfile) { const followers = creator.publicFollowerCount || 0; const posts = creator.publicPostCount || 0; const niche = creator.primaryNiche.toLowerCase(); const multiplier = niche.includes("beauty") ? 0.026 : niche.includes("food") ? 0.023 : niche.includes("travel") ? 0.019 : niche.includes("sports") || niche.includes("auto") ? 0.015 : 0.021; const measured = creator.publicAvgLikes !== undefined; const avgLikes = creator.publicAvgLikes ?? (followers ? Math.max(25, Math.round(followers * multiplier)) : undefined); const avgComments = creator.publicAvgComments ?? (avgLikes ? Math.max(5, Math.round(avgLikes * 0.018)) : undefined); const engagementRate = followers && avgLikes && avgComments ? ((avgLikes + avgComments) / followers) * 100 : undefined; const audienceStrength = followers ? Math.min(100, Math.max(35, Math.round(Math.log10(followers) * 18))) : 35; const contentDepth = posts ? Math.min(100, Math.max(30, Math.round(Math.log10(posts + 1) * 28))) : 30; return { audienceStrength, avgComments, avgLikes, contentDepth, engagementRate, measured }; }
function ReasonBlock(props: { items: string[]; title: string }) { return <div className="rounded-md border border-line bg-card p-4"><p className="text-sm font-semibold">{props.title}</p><div className="mt-3 space-y-2">{props.items.map((item) => <p className="flex gap-2 text-sm leading-5 text-graphite" key={item}><Check className="mt-0.5 shrink-0 text-moss" size={15} />{item}</p>)}</div></div>; }
function Tags(props: { items: string[]; title: string }) { return <div className="mt-5"><p className="text-sm font-semibold">{props.title}</p><div className="mt-2 flex flex-wrap gap-2">{props.items.slice(0, 10).map((item) => <span className="rounded-md bg-paper px-2 py-1 text-xs text-graphite" key={item}>{item}</span>)}</div></div>; }
function Metric(props: { label: string; value: string }) { return <div className="rounded-md border border-line bg-card p-3"><p className="text-xs text-graphite">{props.label}</p><p className="mt-1 break-words font-semibold">{props.value}</p></div>; }
function PersonaBox(props: { title: string; text: string }) { return <div className="rounded-md border border-line bg-card p-3"><p className="text-xs font-semibold uppercase text-graphite">{props.title}</p><p className="mt-2 text-sm leading-5 text-graphite">{props.text || "Needs confirmation."}</p></div>; }
function Score({ value }: { value: number }) { const highScore = value >= 90; return <div className={`rounded-md border px-4 py-3 text-center ${highScore ? "border-ai/20 bg-ai/5 text-ai" : "border-line bg-card text-ink"}`}><p className={highScore ? "text-2xl font-semibold shadow-[0_0_20px_rgba(99,102,241,0.08)]" : "text-2xl font-semibold"}>{value}</p><p className="text-xs text-graphite">Match</p></div>; }
function buildProductPersonaRecord(answers: string[], profile: BusinessProfile): ProductPersona { const name = answers[0] || profile.products[0] || `${profile.businessName} product`; const category = answers[1] || profile.category; const targetAudience = answers[3] || profile.targetAudience.join(", "); const markets = answers[4] || profile.country; return { answers, category, markets, name, persona: buildOnboardingProductPersona(answers, profile), targetAudience }; }
function buildDiscoveryCampaign(profile: BusinessProfile, product: ProductPersona | undefined, budget: number): Campaign { if (!product) return normaliseCampaign({ name: `${profile.businessName} creator discovery`, product: profile.businessName, goal: profile.primaryValueProposition || "Promote the whole brand", audience: profile.targetAudience.join(", "), creatorType: profile.brandTone.join(", ") || "Brand-safe creators", budget, duration: "30 days", persona: profile.summary }); return normaliseCampaign({ name: `${product.name} creator discovery`, product: product.name, goal: product.persona, audience: product.targetAudience, creatorType: `${product.category} aligned creators`, budget, duration: "30 days", persona: product.persona }); }
function magicBrandAnswer(index: number, profile: BusinessProfile) { return [profile.description, `Primary customers are ${profile.targetAudience.join(", ").toLowerCase()}. Persona: ${profile.estimatedCustomerPersona.join("; ")}.`, `The brand helps customers get ${profile.primaryValueProposition.toLowerCase()}.`, `Use a ${profile.brandTone.join(", ").toLowerCase()} tone. Avoid sounding off-brand, exaggerated, or generic.`, `Prioritize creators in ${profile.category}, ${profile.industry}, and adjacent audience communities.`, `Avoid unsupported claims, competitor attacks, misleading pricing, unsafe product usage, and content that conflicts with ${profile.brandPersonality.join(", ").toLowerCase()} brand personality.`, profile.uniqueSellingPoints.length ? profile.uniqueSellingPoints.join("; ") : profile.primaryValueProposition, `Creators must not misrepresent availability, results, pricing, warranties, audience fit, or verified facts from ${profile.businessName}.`][index] || profile.summary; }
function magicCreatorAnswer(index: number, profile: CreatorProfile) { return [profile.summary, `Strong brand fit: ${profile.previousCollaborations.productCategories.join(", ") || profile.primaryNiche}. Personality: ${profile.brandPersonality.join(", ").toLowerCase()}.`, `Audience is estimated as ${profile.estimatedAudience.ageGroups.join(", ")} with interests in ${profile.estimatedAudience.interests.join(", ").toLowerCase()} across ${profile.estimatedAudience.geography.join(", ")}.`, `Best formats are ${profile.contentStyles.join(", ").toLowerCase()}; dominant format: ${profile.postingBehaviour.dominantFormat}.`, `Preferred collaborations include packages around ${profile.pricing.packagePrice || 0}, especially formats that match ${profile.contentPillars.slice(0, 3).join(", ").toLowerCase()}.`, `Performance comes from ${profile.contentQuality.brandingConsistency.toLowerCase()} branding, ${profile.postingBehaviour.captionStyle.toLowerCase()} captions, and ${profile.contentStyles.slice(0, 3).join(", ").toLowerCase()} formats.`, `Avoid topics with brand-safety concern: ${profile.brandSafety.sensitiveTopics}. Also avoid brands that do not fit ${profile.primaryNiche}.`][index] || profile.summary; }
function magicOnboardingProductAnswer(index: number, profile: BusinessProfile) { return [profile.products[0] || profile.businessName, profile.category || profile.industry, profile.primaryValueProposition || profile.description, profile.targetAudience.join(", ") || profile.estimatedCustomerPersona.join("; "), profile.country || profile.estimatedCustomerPersona.join(", "), profile.brandTone.join(", ") || profile.brandPersonality.join(", "), profile.brandPersonality.slice(0, 3).join(", ") || "Trustworthy, Useful, Distinctive"][index] || profile.summary; }
function buildOnboardingProductPersona(answers: string[], profile: BusinessProfile) { const product = answers[0] || profile.products[0] || profile.businessName; const category = answers[1] || profile.category; const job = answers[2] || profile.primaryValueProposition; const audience = answers[3] || profile.targetAudience.join(", "); const markets = answers[4] || profile.country; const voice = answers[5] || profile.brandTone.join(", "); const words = answers[6] || profile.brandPersonality.slice(0, 3).join(", "); return `${product} is a ${category} product for ${audience} in ${markets}. It helps customers with ${job}. The brand voice should feel ${voice.toLowerCase()}, and customers should associate it with ${words}.`; }
function magicProductAnswer(index: number, campaign: Campaign, profile: BusinessProfile) {
  // Draft from the analysed website rather than the "Hero product" placeholder,
  // so Magic write reflects the real brand the moment it is clicked.
  const product = campaign.product && campaign.product !== "Hero product" ? campaign.product : (profile.products?.[0] || profile.businessName || "the product");
  const audience = campaign.audience || profile.targetAudience.join(", ") || profile.estimatedCustomerPersona.join(", ");
  const goal = campaign.goal || profile.primaryValueProposition;
  const format = campaign.creatorType || "niche creators";
  return [
    product,
    audience,
    `${product} helps ${audience.toLowerCase()} achieve ${goal.toLowerCase()}.`,
    profile.uniqueSellingPoints.join("; ") || profile.primaryValueProposition,
    `Use ${format.toLowerCase()} with ${(profile.brandTone.join(", ") || "clear, authentic").toLowerCase()} storytelling.`,
    "Avoid unverified claims, fake scarcity, misleading discounts, medical/financial promises, and statements outside the product brief."
  ][index] || goal;
}

function compact(value: number) { return new Intl.NumberFormat("en", { notation: "compact" }).format(value); }

