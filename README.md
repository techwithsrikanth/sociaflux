# SociaFlux — AI Creator Matchmaking Platform

SociaFlux is an AI-powered creator-brand matchmaking platform for onboarding brands, building product personas, analyzing creators, posting campaigns, and running a two-sided application marketplace between brands and creators.

## Highlights

- Separate brand/business and creator workspaces
- Email and password accounts, with signed session cookies and route guards
- Brand onboarding with AI-assisted persona questions
- Product persona builder, plus campaign posting with niche targeting, minimum audience size and deliverables
- Creator onboarding with a structured niche taxonomy (primary niche, sub-niches, content languages)
- Creator portfolio: add published reels and posts with stats, previewed inline
- Job-board style campaign feed — creators browse, filter, and apply with a pitch and a quote
- Weighted tag/region/barter matching engine shared by both sides of the marketplace
- Region targeting on campaigns (country, state, city) as either a preference or a hard filter
- Barter policy per campaign (paid, paid-or-barter, barter-only) matched against each creator's barter flag
- Brand applicant review — filter by niche, audience size, quote and barter; shortlist or approve
- Contact details (email, phone, manager) stay private until the brand approves an application
- Compatibility scoring, creator comparison table, and AI match justification UI
- Dark, premium UI system built with Tailwind CSS

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Turso (libSQL) via `@libsql/client`
- OpenAI-ready API structure

## Local Development

```bash
npm install
cp .env.example .env.local   # then fill in the SOCIAFLUX_TURSO_* values
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

`SOCIAFLUX_AI_PROVIDER="mock"` uses the built-in heuristic analysis engine; set
`SOCIAFLUX_OPENAI_API_KEY` and `SOCIAFLUX_AI_PROVIDER="openai"` to use real model
calls. Without Turso credentials the app falls back to a local SQLite file, so it
still runs.

All variables are prefixed with `SOCIAFLUX_` so they do not collide with other
projects sharing Vercel team-level environment variables.

### Walking the marketplace flow

Campaigns, applications and creator profiles are stored in the database, so the
two workspaces share one marketplace across browsers and devices.

1. **Brand → Post campaign.** Fill in the brief, pick target niches, a minimum audience size and deliverables, then post it. The campaign goes live on the creator board.
2. **Creator → sign in** at `/creator/login` with a handle (for example `@mayaskinnotes`), pick niches during onboarding, and add published work under **My portfolio**.
3. **Creator → Campaigns.** Filter the board by niche or eligibility, open a campaign, and apply with a pitch and a quote.
4. **Brand → Applicants.** Filter applicants by niche, audience size, quote or barter, review their reels inline, shortlist, and approve. Approving unlocks that creator's email and phone number.

Sign in under a different handle to add a second applicant to the same campaign.

## Accounts and sessions

Both workspaces are behind a real login. An account is an email, a password and
a role; creators also own one Instagram handle, which is what ties the account
to its profile.

| Route | Purpose |
| --- | --- |
| `POST /api/auth/signup` | create an account, claim the handle, start a session |
| `POST /api/auth/login` | email and password only — the handle comes back from the account |
| `POST /api/auth/logout` | expire the cookie |
| `GET /api/auth/session` | who is signed in, or `null` |
| `POST /api/auth/forgot` | email a single-use reset link (always the same reply) |
| `POST /api/auth/reset` | set a new password from a valid reset token |

Passwords are hashed with **scrypt** from `node:crypto` — memory-hard, no
dependency to keep patched. Cost parameters live inside each hash, so raising
them later only affects new passwords and `needsRehash` re-hashes the rest at
next login.

Sessions are **signed cookies rather than database rows**, so verifying one
costs no query and `src/middleware.ts` can check every request. The trade is
that a session cannot be revoked before it expires; rotating
`SOCIAFLUX_SESSION_SECRET` invalidates all of them at once. Signing uses Web
Crypto, not `node:crypto`, so the same code runs in edge middleware.

Middleware is navigation, not a security boundary — it only redirects. Anything
that changes data or reveals private fields checks again server-side via
`src/lib/auth/guard.ts`, because an API route can be called directly.

Login failures return one message for both "no such account" and "wrong
password", so the response cannot be used to discover which emails are
registered.

### Forgotten passwords

A **Forgot password?** link on each login page emails a single-use reset link
to the address on file. Only a SHA-256 of the token is stored, so a leaked
`password_resets` table cannot reset anyone: the raw token lives only in the
link. Tokens expire in an hour, requesting a new one retires the old, and
`consumeResetToken` marks a token used atomically so it cannot be replayed.

With no `SOCIAFLUX_RESEND_API_KEY` set, the link is written to the server log
rather than sent — enough to test locally, and to recover an account from
Vercel function logs before a provider is wired up. For a locked-out account
with no inbox access, `npm run auth:password <email>` sets one directly.

### Signing up with an existing handle

A creator profile may predate accounts, or have been created by an Instagram
connection. Signing up with that handle claims it, unless another account
already has — then sign-up is refused rather than silently taking over
somebody's profile.

## Database

Campaigns, applications, creator profiles and brands live in **Turso** (libSQL),
so a brand and a creator in different browsers see the same marketplace.

Storage is hybrid: the fields the app filters, sorts and joins on are real
columns, while the full domain object is kept as JSON in a `data`/`profile`
column. That keeps the nested shapes the app already uses — campaign targets,
brief assets, creator analytics — without flattening them into dozens of columns.

```bash
npm run db:migrate   # applies src/lib/db/schema.sql (safe to re-run)
npm run db:seed      # demo brand, creators, campaign and applications
```

Both read `SOCIAFLUX_TURSO_DATABASE_URL` and `SOCIAFLUX_TURSO_AUTH_TOKEN` from
`.env.local`. With neither set, the app falls back to a local SQLite file at `.data/sociaflux.db`,
so it still runs without credentials.

| Table | Holds |
| --- | --- |
| `brands` | business profile JSON, keyed by a slug of the brand name |
| `creators` | handle, niches, location, barter flag, follower count as columns; full `CreatorProfile` as JSON |
| `campaigns` | objective, budget, barter policy, region rule as columns; full `Campaign` as JSON |
| `applications` | one row per (campaign, creator), enforced by a unique constraint |

What is still per-browser in `localStorage`: the signed-in creator handle, draft
onboarding answers, and UI preferences like sort order and filters.

### API

| Route | Purpose |
| --- | --- |
| `GET/POST /api/creators` | list the directory, upsert a profile |
| `GET /api/creators/search` | filter by niche, tag, language, country/state/city, price, barter |
| `GET/POST /api/campaigns` | list campaigns, post one |
| `GET/POST /api/applications` | list (by campaign or creator), apply |
| `PATCH/DELETE /api/applications/:id` | brand decision, creator withdrawal |
| `POST /api/match/campaign` | rank creators against a campaign |

Writes from the UI are optimistic: local state updates immediately and the
server's version replaces it when it lands. Creator edits are debounced so
typing through onboarding does not write on every keystroke.

## Verified creator metrics

Instagram serves a stripped page to datacenter IP addresses, so a hosted server
cannot read follower counts from a public profile. Scraping works on a laptop
and returns nothing on Vercel. The app handles this three ways, in this order:

1. **Business Discovery** (covers anyone). The server looks the handle up
   through one professional account that *we* own, so no creator has to log in
   to be analysed. Public Business and Creator accounts only.
2. **Connect Instagram**. The creator authorises the app through Instagram
   Login and their own metrics come from Meta directly. Connected profiles get
   a **Verified** badge, which Business Discovery does not grant, because the
   creator proved they control the account.
3. **Manual entry**. Creators type their follower and post counts. Average
   likes, engagement and campaign reach projections are all derived from the
   follower count, so filling it in restores everything downstream.

### Business Discovery

`POST /api/analyze/creator` tries Business Discovery first and silently falls
back to scraping, reporting which one answered as `source` in the response.

Two accounts are involved and confusing them is the usual setup mistake:

| | Account |
| --- | --- |
| **The lens** | An Instagram professional account you control, linked to a Facebook Page. Its id is `SOCIAFLUX_INSTAGRAM_DISCOVERY_USER_ID`. |
| **The target** | Whoever is being looked up. Needs no relationship to the app, but must be public and professional. |

The token is a **Facebook** token (`EAA…`), not an Instagram Login token
(`IGAA…`), and the two are not interchangeable — `graph.facebook.com` rejects
the latter outright. It needs `instagram_basic`, `pages_show_list` and
`pages_read_engagement`.

```bash
npm run ig:setup              # verify the token, print the lens account id
npm run ig:setup cristiano    # ...and prove a lookup works
```

Because the lens account belongs to the app's own admin, this works while the
Meta app is still in Development mode. App Review and Business Verification are
only needed to run it publicly in production.

A long-lived **Page** token does not expire, so prefer one over a user token
and the 60-day refresh problem disappears.

Unlike scraping, Business Discovery returns recent posts, so average likes and
comments are **measured** rather than inferred from follower count. The UI drops
the "est." suffix when that is the case.

What it will never return: email, phone, audience demographics, or anything at
all for a private or personal account.

Requires a Meta app with the *"Manage messaging & content on Instagram"* use
case and the `instagram_business_basic` permission, set up through **API setup
with Instagram login**. Only Business and Creator accounts return metrics.

In development mode only accounts added as **Instagram testers** can authorise;
App Review lifts that for public use.

Access tokens are stored in their own database column, never inside the profile
JSON, so they are not serialised into any API response. Long-lived tokens last
about 60 days and `refreshLongLivedToken` renews them.

## Campaign briefs and planning

A campaign carries everything a creator needs to make the ad, and everything a
brand needs to judge whether it worked:

- **Reference material** — images, sample videos, brief documents and links, each
  with a note on what creators should take from it. Shown on the campaign before
  a creator applies.
- **Content direction** — how the content should go, who should apply, must-include
  and must-avoid lists, hashtags, mentions, usage rights and a submission deadline.
- **Objective** — `awareness`, `engagement`, `traffic`, `conversions` or `ugc`.
  This changes how click-through and conversion are projected.
- **Targets** — reach, impressions, engagement rate, clicks, conversions, max CPM
  and max cost per conversion. Any target may be left blank to skip tracking it.

`src/lib/campaign-metrics.ts` turns a roster of creators into projected reach,
impressions, engagements, clicks, conversions, spend and CPM, and compares that
against the targets. Reach rate and engagement rate fall as follower count rises,
and repeat deliverables add impressions faster than they add new people.

These are planning heuristics derived from follower counts, not measured
results — the rates are named constants at the top of the module, ready to be
replaced with real platform data.

## Applicant screening

The brand's Applicants page screens like a hiring pipeline:

- every applicant is scored by the matching engine, with a breakdown of tag,
  region and barter fit,
- ranked best-match first, or by projected reach, CPM, quote, followers or recency,
- filtered by niche, audience size, quote, country, barter and "qualified only",
- applicants who fail the campaign's hard rules are flagged with the reason rather
  than hidden,
- **Auto-shortlist best value** shortlists qualified applicants by lowest cost per
  person reached, stopping at the reach target or budget. It never approves anyone.

The **Campaign plan** panel on the same page projects what the shortlisted and
approved roster will deliver, against the campaign's targets and budget.

## Business classification

`src/lib/ai/taxonomy.ts` classifies a scraped site into one of 15 categories. It
scores every category rather than taking the first keyword hit, weights the page
by section (title > description > headings > body > links), matches terms on word
boundaries, and discounts a category supported by only one distinct term.

That combination is what stops a consumer brand being classified by its footer:
an "Investor Relations" link no longer makes a phone maker a venture studio, and
"AI" no longer matches inside "available".

## Matching engine

`src/lib/campaign-matching.ts` scores every creator against a campaign on three
weighted criteria, and reports hard eligibility separately so a brand can rank
everyone while still seeing who its own rules exclude.

| Criterion | Weight | How it scores |
| --- | --- | --- |
| Tag match | 0.5 | Share of the campaign's tags (`targetNiches` + `tags`) covered by the creator's niches and content tags, plus 0.15 when a tag hits their primary niche. Untagged campaigns fall back to keyword affinity against the brief. |
| Region match | 0.3 | 1.0 when the creator satisfies a target at the specificity the campaign asked for (country, state or city); 0.5 for the right country but wrong state/city; 0.5 for an unstated location; 0 otherwise. No targets means open worldwide. |
| Barter compatibility | 0.2 | `paid` ignores barter (1.0 for everyone); `flexible` gives 1.0 to barter-friendly creators and 0.5 to the rest; `barter_only` gives 1.0 or 0. |

Tag matching is tolerant of phrasing: a campaign tag counts when it equals,
contains, or is contained by one of the creator's tags, so `Skincare` matches a
creator tagged `Skincare education`.

Hard filters set `eligible: false` with a reason, and are the only rules that
exclude rather than rank:

- the creator is below the campaign's `minFollowers` floor,
- the campaign is `barter_only` and the creator is not open to barter,
- `regionRequirement` is `"required"` and the creator is outside the targets, or has no stated location.

`POST /api/match/campaign` exposes the engine. Pass a `campaign` (and optionally
`creators`, `requireRegionMatch`, `eligibleOnly`) and it returns ranked matches
with a per-criterion breakdown:

```bash
curl -X POST http://localhost:3000/api/match/campaign \
  -H "content-type: application/json" \
  -d '{"campaign":{"name":"Barter push","targetNiches":["Skincare"],"barterPolicy":"barter_only","budget":0}}'
```

`GET /api/creators/search` filters the directory on `niche`, `tag` (repeatable),
`language`, `country`, `state`, `city`, `maxPrice` and `openForBarter`.

Country codes are ISO 3166-1 alpha-2. Inputs are canonicalised on the way in, so
`IN`, `in` and `India` are equivalent, as are common aliases like `UK` for `GB`.

## Tests

```bash
npm test
```

Runs `tests/*.test.ts` on the Node test runner via `tsx` — 244 cases covering tag
intersection, barter policy, region specificity, the hard filters, score
weighting and ranking order, the reach/conversion projection model, and the
business classifier including the Samsung and Apple regressions, and the
database repositories, the Instagram Business Discovery parser, and password hashing session
signing, and the single-use password-reset tokens, the brand/creator marketplace flow and
per-brand campaign scoping, brand-profile persistence and brand-initiated
outreach. The
database tests run against a throwaway local SQLite file, never against Turso.

## Deployment

This project is ready to deploy on Vercel as a Next.js app.

1. Push this repository to GitHub.
2. Import the GitHub repo into Vercel.
3. Set any production environment variables from `.env.example`.
4. Deploy.

Set `SOCIAFLUX_TURSO_DATABASE_URL` and `SOCIAFLUX_TURSO_AUTH_TOKEN` in the Vercel
project so the deployed instance talks to the same database.

## Environment Variables

Copy `.env.example` to `.env.local` for local development and fill in the required keys.
