# PRD: CiteBrief
**Client-ready AI-search reporting for agencies**  
Version 2.4 · 15 Sep 2026 · Domain: getcitebrief.com · Next.js 16 on Cloudflare Workers (OpenNext) · Better Auth · Dodo Payments · Cloudflare AI Gateway · Cloudflare Email Service

This document is the product source of truth. Code in `src/lib/billing.ts`, `src/lib/entitlements.ts`, and `src/lib/command-center.ts` is canonical for plan numbers and gates. Do not invent features here.

**Canonical domain:** `getcitebrief.com`. `citebrief.com` is taken. Optional redirect hosts: `citebrief.xyz`, `www.citebrief.xyz`, `www.getcitebrief.com` (301 to `getcitebrief.com`; they must not set auth cookies).

**Status labels**

| Label | Meaning |
|---|---|
| **Shipped** | Implemented and gated in this repo. |
| **Later** | Specified, not built. Do not market as live. |
| **Ops** | Dashboard, secrets, live verification, or founder process — not an app feature. |

---

## 1. One-liner
Agencies enter a client brand and 20 buying questions. CiteBrief checks ChatGPT, Gemini, Grok, and Google AI Overviews, then sends a polished white-label Friday report that proves whether AI search is sending buyers to the client or to competitors.

The weekly artifact is the PDF. The business is the agency workflow around it: brand setup, prompt strategy, weekly history, client links, white-label sending, team roles, billing controls, and upgrade paths tied to more client accounts.

**Positioning:** the weekly AI-search report agencies send to clients.

**Do not position as:** a cheap AI visibility score, an SEO keyword tracker, a content generator, or a Peec/Profound replacement.

---

## 2. Problem
SEO, content, PR, and PPC agencies are being asked the same question by clients: "Are we showing up in AI answers?" Agencies can sell AI-search monitoring as part of $3k-$8k monthly retainers, but the reporting work is ugly.

Current options create a gap:
- Cheap trackers produce a score, not a client-ready deliverable.
- Enterprise platforms are deep, expensive, and often too technical for account managers.
- Dashboards still force the agency to turn raw findings into a client-facing story.
- Manual reporting takes 40-80 account-manager hours/month across a small book of clients.

The pain is not only measurement. The pain is proving visible work every month so the retainer survives.

**Revenue thesis:** if CiteBrief saves an agency 6-10 reporting hours/month and helps them defend or upsell even one $3k+ retainer, $99-$1,499+/month is an easy operating expense.

## 3. Who
**Primary buyer:** agency owner, strategy lead, SEO director, or account director with 5-40 active clients.  
**Daily user:** account manager or strategist responsible for recurring client reporting.  
**Reader:** client founder, CMO, marketing lead, or RevOps lead. They should not need to understand GEO/AEO jargon.

Best-fit agencies:
- SEO/content agencies adding AI-search reporting to retainers.
- PR agencies proving third-party mentions and citations matter.
- Paid/search agencies defending strategy in a world where buyers ask ChatGPT first.
- B2B SaaS agencies with clients that care about comparison and shortlist queries.

Not for indie founders who want a $29 personal score. Not for enterprise teams that need deep share-of-voice analytics and custom research dashboards from day one.

---

## 4. Jobs
1. Prove to the client that the agency checked AI-search visibility this period.
2. Show whether the client was named, recommended, or cited.
3. Show which competitor won the answer when the client did not.
4. Turn the findings into three concrete actions for next week.
5. Give the account manager a polished artifact they can forward without rewriting.
6. Give the agency owner a repeatable reporting product they can package into retainers.

The core job is not "track prompts." The core job is "make AI-search visibility billable and defensible."

---

## 5. Auth — Better Auth
**Shipped.** `better-auth` + `better-auth-cloudflare` on the Worker. D1 is the source of truth. KV is used for Better Auth rate-limit / session cache.

Auth is **single-domain first-party auth** on `getcitebrief.com`. Do not implement multi-domain shared auth, cross-domain session sharing, or a separate auth subdomain.

**Methods (shipped)**
- Email + password (email verification required in production or when the `EMAIL` binding is ready)
- Magic link (Cloudflare Email Service, not Resend)
- Google OAuth (live credentials when set; stub client ids in local/dev only)

**Rules**
- Init auth **inside the request** (`c.env.DB`). Never a global D1 binding.
- `BETTER_AUTH_URL` is the canonical public origin for that environment:
  - Production Worker vars: `https://getcitebrief.com`
  - Wrangler `preview` env: `https://citebrief.sarmaasis.workers.dev`
  - Wrangler `dev` env / local: `http://localhost:3000`
- Better Auth `baseURL` and `trustedOrigins` both resolve to that single origin. Do not use `BETTER_AUTH_TRUSTED_ORIGINS` for multiple app domains.
- Secrets: `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` as Wrangler secrets. Production refuses stub / `dev-only-replace-with-BETTER_AUTH_SECRET` values (worker secret gate, §21.2).
- Workspace created on first verified login, with `status: "trialing"` + `trialEndsAt` (14 days). Pending invite by token or matching email joins that workspace instead of minting a new owner workspace or trial.
- Seats follow §11. **Owners invite members only.** Invites enforce the seat cap (members + pending invites). Agency+.
- Optional domains 301 to `getcitebrief.com` and must not set or share auth cookies.
- Client report links under `/r/[token]` are public token links, not authenticated sessions. They are noindex.

**Packages:** `better-auth`, `better-auth-cloudflare`, `@better-auth/drizzle-adapter`, `drizzle-orm`.

---

## 6. Payments — Dodo
**Shipped.** Dodo has a first-party Cloudflare + Hono adapter. Do not use Stripe. Primary checkout is `GET /api/checkout?plan=…`. Official `@dodopayments/hono` Checkout also mounts at `/api/checkout/hono`.

**List prices (code: `src/lib/billing.ts`)**

| Product | Amount | Interval | Notes |
|---|---|---|---|
| CiteBrief Starter | $99 | month | Public card |
| CiteBrief Agency | $249 | month | Public card, recommended |
| CiteBrief Studio | $799 | month | Public card |
| CiteBrief Enterprise | $1,499+ | month or annual contract | No public checkout card |
| Extra brand | $29 | month addon | Agency / Studio / Enterprise only |
| Extra seat | $15 | month addon | After plan seat cap |
| Extra run | $9 | one-time / usage meter | List price in code (not a $9–$15 range) |
| Premium engine pack | $99 | month addon | Listed at the low end until a dedicated Dodo product is confirmed |

**Later / Ops**
- Done-with-you setup ($299–$999 one-time): founder offer, not a Dodo SKU in app.
- Annual Dodo products: checkout sends `interval=annual` (10 months prepaid). Live annual product IDs are optional env (`DODO_PRODUCT_*_ANNUAL`). If unset, the charge may use the monthly product until those IDs exist.

**Worker flow**
1. Logged-in **owner** hits `GET /api/checkout?plan=agency` (or starter / studio / enterprise)
2. Dodo hosted checkout, or local stub (dev only)
3. Return URL `/app/billing/success`
4. Webhook Worker verifies signature (`DODO_PAYMENTS_WEBHOOK_KEY`) via `@dodopayments/hono`
5. Handle subscription/payment events; idempotent on webhook event id (D1 unique)
6. Dunning email on failed subscription events

**Local stub checkout (dev only):** when Dodo is unbound and the runtime is not production, checkout persists a paid `status: "active"` row for the selected plan (`shouldWriteStubPaidSubscription`). Production never writes a fake paid row; stub billing returns 503.

**Secrets:** `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` | `live_mode`). Optional product ids: `DODO_PRODUCT_STARTER`, `DODO_PRODUCT_AGENCY`, `DODO_PRODUCT_STUDIO`, `DODO_PRODUCT_ENTERPRISE`, extra-brand / extra-run / extra-seat / premium-engine, plus annual variants.

**Fee (US cards, estimate):** 4% + $0.40 + 0.5% subscription ≈ **4.5% + $0.40**. Tax included in Dodo.

Packages: `dodopayments`, `@dodopayments/hono`

---

## 7. Product scope — full product, not an MVP
See §18 for the feature map with **Shipped** / **Later** labels. Shipping order was phased, but the paid surface that affects willingness to pay is:

- The first report must look polished enough to forward to a client.
- The account manager must understand what changed without reading raw engine output.
- The agency must be able to add multiple client brands quickly.
- Agency Home is a command center, not a thin table of report runs.
- The product must surface client risk, recommended actions, and upsell opportunities from **stored** report data.
- The owner must see plan limits, usage, invoices (Dodo portal), and expansion paths.
- Client-facing pages and Friday mail must look like the agency, not CiteBrief.

Time-to-first-PDF target: **< 8 minutes**.  
Time-to-second-client target: **< 3 minutes** once the workspace is configured.

Polish bar: a paying agency should be able to send the first report without saying "this is a beta."

---

## 8. Report spec
The report is the product. It must be short, printable, client-safe, and opinionated.

**Cover**
- Agency logo, client brand, date range, prepared-by footer.
- Main score: **Named in X of 20 buyer questions this week.**
- Secondary score: **Recommended in Y of 20.**
- Change from previous report when available.
- One plain-English paragraph: what changed, where the client is exposed, and who is winning.

**Prompt rows**
- Buyer question.
- Named? yes/no.
- Recommended? yes/no.
- Engines where the brand appeared.
- Who won.
- Best cited URL when available.
- One sentence max 20 words.
- One next action.

**Close**
- 3 priorities ranked by commercial urgency:
  1. high-intent buyer question where the client is missing,
  2. competitor appears repeatedly,
  3. fix can be done in 10 days.
- Each priority includes owner suggestion: content, site, PR, listings, or sales enablement.

**Client-safe rules**
- Never say GEO, AEO, LLM, embeddings, prompt, token, or model in the default PDF.
- **Later:** agency-chosen "technical mode." Default writer always strips jargon.
- Do not include raw AI text in the default PDF.
- Do not mention failed engines unless fewer than 3 core engines succeeded.
- If the client is doing poorly, say it plainly but with next steps.

---

## 9. Architecture — Next.js on Workers (no Pages)

```
Next.js 16  —  @opennextjs/cloudflare
        │
        ├─ App Router UI (marketing + app)
        ├─ Route Handlers / Server Actions
        └─ Worker bindings via getCloudflareContext()
              ├─ D1
              ├─ KV (Better Auth + route rate limits + ISR cache)
              ├─ R2
              ├─ Queue (citebrief-runs; consumer is this same Worker)
              ├─ Browser Rendering (AI Overviews)
              ├─ AI Gateway
              └─ send_email EMAIL (Cloudflare Email Service)

Better Auth  (better-auth-cloudflare, init per request)
Dodo         (checkout route + /api/webhooks/dodo)
Email        (Cloudflare Email Service; not Resend)
Cron         hourly (`0 * * * *`); enqueue when tenant TZ is Friday 06:00
```

Create with `npm create cloudflare@latest -- --platform=workers`.  
`nodejs_compat` on. Incremental cache → KV. Static assets ship with the Worker (Workers Static Assets). **Do not use Pages.**

Long jobs (engine calls, PDF) run in the **Queue consumer on this Worker**, not inside the Next.js request. The app only enqueues and polls. **Later:** Cloudflare Workflows as an alternative runner.

### 9.1 AI Gateway policy
CiteBrief uses **Cloudflare AI Gateway as the AI control plane**. Do not wire product code directly to individual provider API keys.

What goes through AI Gateway:
- OpenAI / ChatGPT-style answer generation.
- Gemini answer generation.
- Claude answer generation (adapter kept; paused on all plans for now).
- Grok answer generation.
- Extractor and writer **Later** if they move off the deterministic path onto Workers AI.

What does not go through AI Gateway:
- Google AI Overviews browser capture (Browser Rendering).
- Cloudflare Email, Dodo, auth, storage, and ordinary app APIs.

Configuration:
- Required app secrets: `CF_ACCOUNT_ID`, `AI_GATEWAY_ID`, `CF_AI_GATEWAY_TOKEN`.
- Prefer AI Gateway stored provider keys or unified billing where available.
- Local development may use deterministic stubs when AI Gateway config is missing or stub.
- **Shipped fail-closed:** a live-configured engine that errors must fail that engine (4/5 soft-fail). It must not return a successful-looking stub answer.

Gateway responsibilities (product policy):
- Analytics by workspace, brand, engine, run, and plan.
- Centralized request logging.
- Cache repeated prompt+engine calls when freshness allows it. Product soft-fail path uses D1 `engine_cache` first. Gateway edge cache is additive.
- **Later / Ops:** spend limits by plan, workspace, and engine in the Cloudflare dashboard.
- Retries and model fallback for flaky providers.
- Custom metadata on every request: `workspace_id`, `brand_id`, `run_id`, `engine`, `plan`, `prompt_hash`.

Implementation rule:
- All model adapters call a single internal `aiGatewayRequest()` helper.
- No app code should import or read `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `XAI_API_KEY`.
- Perplexity is not in the launch engine set because it is not available in the current Cloudflare AI Gateway provider-native / unified-billing setup CiteBrief relies on. If Cloudflare adds it later, treat it as a separate future engine, not a launch dependency.

---

## 10. Unit economics

The rich dashboard is not the cost problem. The cost problem is report generation: brands × prompts × engines × reruns. Product strategy must make the dashboard feel premium while keeping report execution metered and predictable.

**Fixed baseline (estimate):** Workers Paid, domain, and email/domain tooling start low, roughly **$7–$30/mo** before volume.

**Agency included usage (Gateway insights, Claude off the default set):** Claude Sonnet 5 web search was **~$0.19/request** and ~96% of a $3.80 invoice (1.56M tokens / 19 calls). GPT-5.4-mini ~$0.008, Gemini 3.6 Flash ~$0.006, Grok 4.3 ~$0.001. Agency Friday default is ChatGPT + Gemini + Grok + AIO (no Claude) → **~$0.77/run**, **10 × 4.3 × ~$0.77 ≈ $33 AI/mo** before Gateway fee. Extra re-checks $9.

**Per full Agency account at included Friday-only usage**
| Cost item | Estimate |
|---|---:|
| AI/search engine calls | **~$33/mo** without Claude |
| Cloudflare AI Gateway unified billing fee | ~5% (~$2) |
| Cloudflare Workers/D1/KV/R2/Queues | <$1–$3/mo at scale |
| PDF/report storage | cents to <$1/mo |
| Email sending | cents/customer (Cloudflare Email Service) |
| Dodo fee on $249 | ~$11–$12 |
| **Total hard cost** | **~$45–$50/mo at Friday-only included use** |

| Plan | List | Included COGS (this mix) | Dodo fee | Gross at full included |
|---|---|---|---|---|
| Starter | $99 | ~$5–$15 (monthly, 2 brands, no Claude) | ~$5 | positive |
| Agency | $249 | **~$45–$50** Friday-only, no Claude | ~$12 | **~$185–$190 (~74%)** |
| Studio | $799 | **~$45–$80** Friday-only without Claude (Grok included); Claude paused | ~$36 | healthy without Claude |
| Enterprise | $1,499+ | usage-based | contract | Claude paused with other plans |

100 Agency customers at $249: **$24.9k MRR**. Keep Claude off Agency default — one 20-prompt Claude pass is ~$3.80 by itself.

Free-trial / unpaid cost:
- Caps: 1 brand, 5 prompts, 1 full report, **2 sources (ChatGPT + Gemini)**. Claude never runs on trial.
- Intended run: 10 cheap Flash/mini calls ≈ **$0.14** (hard cap 15). The **$3.80** invoice was Claude Sonnet 5 web-search tokens, not a uniform $0.076/call.
- Must not include unlimited reruns, recurring weekly reports, premium capacity, or bulk sending.

Expansion revenue (list):
- Extra brand: **$29/mo** on Agency, Studio, Enterprise.
- Extra weekly run: **$9**.
- Additional seats: included up to plan cap, then **$15/seat/mo**.
- Premium engine pack: **$99/mo** list for extra Grok / engine volume.
- White-label custom sender/domain: Studio+.
- Done-with-you setup: **Ops** founder offer.
- Quarterly strategy export: **Later**, $99/report, only after core retention is strong.

Cost controls **Shipped** in code:
- Agency includes 1 scheduled weekly report per brand.
- Manual reruns: Starter includes **2 monthly re-check credits**. Agency includes **10 monthly re-check credits**. Studio/Enterprise include **100 monthly re-check credits** by default. Extra re-checks are **$9** after monthly credits.
- Hard-stop at 3× included calls per brand/week (`hardStopMultiplier`).
- Claude is **paused on all plans for now** (adapter kept internally, not shown in workspace settings or marketing). Agency and Studio default engines: ChatGPT, Gemini, Grok, AI Overviews. Claude web search ingested ~82k tokens/request in production.
- Prompt generation uses **Workers AI** (`@cf/meta/llama-3.1-8b-instruct-fast`) with `max_tokens=700`, no web search, and template fallback. Do not use OpenAI for onboarding prompt generation.
- Dashboard/risk/opportunity views reuse stored report data. No hidden model calls on page load.

**Later / Ops:** AI Overview/browser spend caps in Gateway; mandatory Gateway spend limits by plan.

---

## 11. Pricing

**Shipped list prices**

| Plan | Price | Brands | Prompts | Seats | Cadence | Email send | Command Center |
|---|---|---|---|---|---|---|---|
| Starter | $99/mo | 2 | 20 | 1 | Monthly (first Friday 06:00 local) | No | No (lighter Home) |
| **Agency** | **$249/mo** | **10** | 20 | **3** | **Weekly** | Yes, approve-before-send | Yes |
| Studio | $799/mo | 25 | 30 | 10 | Weekly | Yes, bulk approve/send | Yes + export |
| Enterprise | $1,499+/mo | Contract (code floor 25/30/10 until extras stored) | Custom | Custom | Weekly/custom | Yes | Yes |

Annual = 10 months prepaid (2 months free). Public `/pricing` shows **three cards** plus an Enterprise contract note. Feature Agency at $249. Do not ship a $29 personal plan.

### Trial (not paid Agency)

| | Value |
|---|---|
| Marketing / FAQ | 14 days |
| Caps (unpaid **or** `status: trialing`) | **1 brand / 1 seat / 1 full run** |
| Continuation plan | Stored `subscriptions.plan` may be starter/agency/studio; **entitlements stay trial-like until `status: active`** |
| Weekly send, members, history, Slack, Command Center, email send | Off |
| Client CC | **One CiteBrief-branded CC** on the first report (`trial_client_cc_used`); not agency white-label |

**Shipped:** first verified workspace insert writes `status: "trialing"` + `trialEndsAt` (14 days). After expiry without pay, caps stay unpaid 1/1/1 until `status: active`. Invite join does not mint a new trial.

### Permission matrix (paid `active` only)

| Capability | Starter | Agency | Studio | Enterprise |
|---|---|---|---|---|
| Brands included | 2 | 10 | 25 | 25 floor |
| Seats included | 1 (owner) | 3 | 10 | 10 floor |
| Extra brands $29 | No | Yes | Yes | Yes |
| Extra seats $15 | No | Yes | Yes | Yes |
| Extra run $9 | Yes (paid) | Yes | Yes | Yes |
| Monthly re-check credits | 2 | 10 | 100 | 100 floor |
| Weekly Friday send | No (monthly first Friday) | Yes | Yes | Yes |
| Email send to clients | No | Yes | Yes | Yes |
| Approve before send | No | Required | Required | Required |
| Bulk approve / send | No | No | Yes | Yes |
| Client CC | No | Yes | Yes | Yes |
| Custom sender name/domain | No | No | Yes | Yes |
| Members invite (owner only) | No | Yes | Yes | Yes |
| Slack webhook | No | Yes | Yes | Yes |
| History / MoM | No | Yes | Yes | Yes |
| Command Center rollups | No | Yes | Yes | Yes |
| Weekly send queue `/app/reports` | No | Yes | Yes | Yes |
| Portfolio CSV export | No | No | Yes | Yes |
| Extra Grok / engine volume | No | Premium pack only | Included Grok + pack | Yes |
| Premium engine pack $99 | No | Yes | Yes | Yes |

### Plan gates (copy)

**Starter:** 2 brands, 1 seat, monthly cadence, CiteBrief sender, PDF download and private client link, basic recommended actions. No weekly automation, no email sending to clients, no portfolio Command Center.

**Agency:** 10 brands, 3 seats, weekly Friday reports, 10 monthly re-check credits, white-label PDF (logo, color, footer), agency-branded client links with expiry and revoke, client CC, report approval before sending, suggested client email, month-over-month history, source evidence / raw output audit, recommended next actions, upsell notes, client risk flags, Command Center, report pipeline, Slack webhook, extra brands $29.

**Studio:** 25 brands, 30 prompts, 10 seats, everything in Agency, 100 monthly re-check credits, custom sender name/domain, bulk approve and send, advanced portfolio filters + CSV export, Grok included (with ChatGPT / Gemini / AI Overviews), premium pack available. Public `/pricing` also lists client portal archive, priority support, and internal COGS export — those three bullets are **Later** (do not treat as Shipped). Bulk send, custom sender, and extra brands are **Shipped**. The live Studio card does not list “priority processing.”

**Enterprise:** starts at $1,499/mo or annual contract. Custom limits, dedicated onboarding, higher premium-engine allocation, SSO/security review **when required** (**Later** in-app SSO). No self-serve Enterprise checkout on `/pricing`.

**Pricing psychology**
- Starter is for freelancers and solo consultants testing the workflow.
- Agency is the main plan: 10 client brands at $24.90/client/month.
- Studio is for agencies already reselling AI-search reporting across a client book.
- Enterprise is high-volume/custom usage on a contract.
- No free forever plan.

---

## 12. Competitors
Otterly $29–$489 (~$0.8M). Peec $95–$495 ($10M+ ARR). Profound $399–$5k ($1B val). Semrush/Ahrefs modules.  
Win on agency workflow and the white-label Friday report, not analytic depth.

**Competitive posture**
- Against cheap trackers: "your client cannot read a dashboard score."
- Against deep platforms: "your account manager needs a finished report by Friday."
- Against Semrush/Ahrefs modules: "AI-search reporting is not another SEO tab; it is a client deliverable."
- Against manual slides: "stop spending strategist time copying screenshots."

**Moat to build**
- Better report writing, not more charts.
- Better prompt packs by industry.
- Better agency white-label experience.
- Better history of who wins buyer questions over time.
- More trust: stored raw outputs, source URLs, soft-fail engine handling.

---

## 13. Metrics
Activation: time to first PDF; % trials that generate a report; % that copy/share/send; time to second brand.  
Revenue: trial-to-paid by plan; MRR; expansion; average brands/workspace; extra brand attach; annual prepay.  
Retention: m2 logo retention; weekly report send rate; client link opens; PDFs CC'd to client; consecutive Friday reports per brand.  
Cost/reliability: COGS/report; engine success rate; PDF success rate; support tickets per 100 workspaces.

North star: **paid workspaces that sent a PDF to a client this month**.

---

## 14. Risks
Engine drift → official APIs, store raw.  
AIO layout change → fail soft, ship 3-engine PDF.  
Cost spike → AI Gateway spend limits (**Ops**), cache, mid models, plan caps.  
“Not Peec” → stay the report layer.  
Report not trusted → expose sources, raw output audit drawer, and engine timestamps.  
Too much agency setup → 6-field onboarding, reusable prompt packs, duplicate brand.  
Client asks "what do we do now?" → every report ends with prioritized actions.  
Race to cheap tracking → keep white-label, sending, history, and team workflow behind paid plans.

---

## 15. Historical build week
Week 1–6 below is the original sequencing. It is not a current backlog.

Week 1 Foundation: Next.js + OpenNext Worker, Better Auth, D1, app shell, marketing shell.  
Week 2 First revenue artifact: onboarding, brand setup, generated 20 prompts, AI Gateway engine fan-out, first polished PDF.  
Week 3 Paid workflow: Dodo checkout/webhooks, plan limits, report download, private client link, white-label logo/color.  
Week 4 Agency repeatability: duplicate brand, history, score trend, Friday cron, report email, client CC.  
Week 5 Team and trust: members, raw output audit drawer, retry failed engine, source links, failed-engine fallback.  
Week 6 Revenue hardening: extra brand/run billing, billing portal, dunning, usage meters, Studio gates, sample report marketing.

---

## 16. Data model
Better Auth: users, sessions, accounts, verifications  

App (D1):
- `workspaces` (timezone, sender name/domain + DNS checklist verification, default engines, Slack webhook, minutes-saved-per-report)
- `workspace_members` (owner / admin / member)
- `workspace_invites`
- `brands` (client_owner, archive)
- `competitors` · `prompts` · `runs` (extra_run, consume_credit, billed_at) · `run_rows` (gateway request id, confidence, engine_at, raw)
- `reports` (scores, share token/expiry/revoke/opens, sent_at, approval_state, suggested email)
- `subscriptions` (dodo ids, plan, status, extras, premium_engine_pack, billing_interval, trial_ends_at)
- `webhook_events` (idempotent event id)
- `brand_kits`
- `audit_logs`
- `opportunity_plans`
- `engine_cache`

R2: `reports/{workspace}/{brand}/{yyyy-mm-dd}.pdf` and `.html`

**Migrations 0008+ (apply in every environment that runs the app)**

| Id | What |
|---|---|
| 0008 | Client owner, recommended score, share open tracking, engine_at, sender_domain, extra seats/credits, billing interval |
| 0009 | Run extra_run / consume_credit / billed_at (meter after a report exists) |
| 0010 | Share revoke, `audit_logs` |
| 0011 | Premium engine pack, report approval + suggested email |
| 0012 | `minutes_saved_per_report`, `opportunity_plans` |
| 0017 | `subscriptions.plan_metering_since` — mid-period plan-change metering window |
| 0018 | `subscriptions.trial_client_cc_used` — one CiteBrief-branded trial client CC |
| 0019 | Sender domain verification checklist (`spf`/`dkim`/`dmarc`/`cf` + `verified_at`) |

---

# PROMPTS

Three layers. Do not mix.

1. **Tracked prompts** — what buyers ask (the 20).  
2. **Engine wrapper** — how we query each model.  
3. **Writer** — how we turn raw answers into the PDF.

---

## A. How to pick the 20 (rules that actually move a client)

Track **buying-stage** questions only. Discovery fluff wastes 80 calls.

Must-have mix (20):
- 4 Discovery (“best X for Y”)
- 4 Comparison (“A vs B”, “alternatives to incumbent”)
- 4 Job-to-be-done / constraint (“with SOC2”, “for a 12-person agency”)
- 4 Switch / risk (“worth it”, “problems with”, “when to leave”)
- 4 Incumbent-named (the brands ChatGPT already seeds into its own search)

Why this mix: ChatGPT often writes competitor names into its first search before fetching anything. If you never track `[incumbent] alternatives` and `[incumbent] vs [you]`, you miss the shortlist moment.

**Write like a buyer. Not like SEO.**
- Good: `best CRM for a 15-person B2B sales team 2026`
- Bad: `Acme AI visibility citations`
- Good: `HubSpot alternatives that are cheaper for startups`
- Bad: `does ChatGPT mention Acme`

Always include year on “best” prompts. Always include the job and the buyer size when it changes the shortlist.

---

## B. Master template (fill slots)

```
[category] = client’s category (CRM, returns software, HVAC scheduling…)
[vertical] = industry if it matters
[buyer]    = who pays (agency, DTC brand, clinic…)
[job]      = the work (invoicing + time tracking)
[incumbent]= category default (HubSpot, Loop, Jobber…)
[brand]    = your client
[comp]     = named rival
```

### Discovery (4)
```
best [category] for [buyer] [year]
best [category] for [vertical] teams
what [category] should a [buyer] use for [job]
[category] tools that actually work for [constraint]
```

### Comparison (4)
```
[incumbent] alternatives [year]
[brand] vs [comp]
[incumbent] vs [brand] which is better for [buyer]
best [category] compared to [incumbent]
```

### Job / constraint (4)
```
[category] with [must-have] for [buyer]
cheapest [category] that can [job]
[category] for [buyer] that does not need a 3-month implementation
[category] that integrates with [tool]
```

### Switch / risk (4)
```
is [incumbent] worth it for a [buyer]
problems with [incumbent]
when to switch from [incumbent]
[incumbent] vs cheaper alternatives [year]
```

### Incumbent-seeded (4)
```
[incumbent] alternatives for [job]
who is better than [incumbent] for [vertical]
[comp] vs [incumbent] vs [brand]
recommend a [category] instead of [incumbent]
```

---

## C. Ready 20 — SaaS example
Client: **Northstar** · category project management · buyer agencies · incumbents Asana, Monday, ClickUp

```
1. best project management software for agencies 2026
2. best project management tool for a 12-person marketing agency
3. what project management software should an agency use for client work and time tracking
4. project management tools that work for agencies without a 3-month setup
5. Asana alternatives for agencies 2026
6. Northstar vs ClickUp
7. Monday.com vs Northstar which is better for client retainers
8. best agency project management compared to Asana
9. project management software with time tracking and invoicing for agencies
10. cheapest project management tool that handles clients, tasks, and approvals
11. project management for agencies that does not need a consultant
12. project management tool that integrates with Slack and Google Drive
13. is Asana worth it for a small agency
14. problems with Monday.com for agencies
15. when to switch off Asana
16. Asana vs cheaper alternatives 2026
17. Asana alternatives for client billing and retainers
18. who is better than Monday.com for marketing agencies
19. ClickUp vs Asana vs Northstar
20. recommend a project management tool instead of Asana for an agency
```

Same 20-pattern works for ecom returns, field service, CRM, SEO tools. Swap slots only.

---

## D. Engine wrapper (send through AI Gateway, not directly to providers)

Same user prompt every engine. System prompt changes by engine. The adapter sends provider-native requests through Cloudflare AI Gateway with request metadata for observability, cost tracking, caching, and debugging.

**User message (all engines)**
```
Answer as if a [buyer] asked this while choosing a vendor this week.
Question: {prompt}

Rules:
- Name specific products. Do not give generic advice.
- If you recommend a shortlist, order it.
- Mention pricing only if you are confident.
- If you cite sources, keep the URLs.
- Do not ask a follow-up question.
```

**OpenAI (Responses + web)**
```
You are a buying advisor. Use web search. Prefer current vendor pages, G2, and recent roundups. Return the shortlist and any URLs you used.
```

**Gemini + Search**
```
Use Google Search grounding. Return who you would shortlist and which pages support that.
```

**Grok**
```
You are a buying advisor. Return a ranked shortlist of products with brief reasons and URLs when known.
```

**AIO (browser):** paste the prompt in the search box only. No system prompt. Store the overview text + listed links. This path uses Browser Rendering, not AI Gateway.

**Gateway metadata**
Every AI Gateway call must include:
```
workspace_id
brand_id
run_id
engine
plan
prompt_hash
cache_policy: "fresh" | "allow_24h"
```

---

## E. Extractor (per prompt × engine)

Cheap. Deterministic in code today (Workers AI through AI Gateway is **Later**).

```
Brand: {brand}
Competitors: {comp_list}
Prompt: {prompt}
Engine: {engine}
Answer:
{raw_answer}

Extract JSON only:
{
  "mentioned": true|false,
  "recommended": true|false,
  "rank_in_shortlist": number|null,
  "cited_urls": ["..."],
  "cited_brand_url": true|false,
  "who_won": "brand name that was recommended first",
  "others_named": ["..."],
  "sentence": "max 20 words, plain English, no GEO/AEO/SEO jargon"
}

mentioned = brand name appears.
recommended = brand is advised or in the top shortlist, not just a passing mention.
who_won = first named recommendation, even if it is not us.
```

---

## F. PDF writer (the money prompt)

```
You write a one-sitting report for a client CMO. They do not know what GEO is. They pay an agency to tell them if AI search is sending demand to them or to a rival.

Agency: {agency}
Brand: {brand}
Period: {period}
Competitors: {comps}

Here is extracted data for 20 prompts across 5 core sources:
{json_rows}

Write:
1. Score line: "Named in X of 20 buyer questions this week."
2. One paragraph (max 80 words) a CMO will read. No jargon. Name the biggest hole.
3. Table rows for all 20: Prompt | Named? | Who won | One next action
4. Three priorities for the next 10 days. Each priority:
   - the buyer question we lose
   - why it matters (shortlist / switch / comparison)
   - the action (page to fix, article to write, or third-party mention to earn)
   - owner suggestion: content / site / PR

Next-action vocabulary (use only these):
- Write a comparison page for {incumbent} vs {brand}
- Publish a "best {category} for {buyer}" page with pricing table
- Earn a mention on {cited_domain}
- Fix the pricing / integrations section on {url}
- Get listed on {roundup or G2 category}

Do not say GEO, AEO, LLM, prompt, engine, citation graph.
Do not pad. If we were named, say so. If we lost to {comp}, say so.
```

---

## G. Prompt-pack generator (onboarding)

When an agency adds a brand, ask 6 fields, then fill the 20.

```
You build a 20-prompt tracking set for AI-search buyer questions.

Category: {category}
Buyer: {buyer}
Job: {job}
Brand: {brand}
Incumbent: {incumbent}
Competitors: {comps}
Must-have constraint: {constraint}
Year: 2026

Return exactly 20 prompts, numbered, using the 4+4+4+4+4 mix:
Discovery, Comparison, Job/constraint, Switch/risk, Incumbent-seeded.

No brand vanity ("does ChatGPT mention X").
No keywords. Full questions a person would type.
Include the year on every "best" prompt.
```

---

## H. What not to track
- “What is {brand}?”
- “{brand} login”
- Thought-leadership topics the buyer will never ask an assistant
- 50 near-duplicate “best X” rewrites (keep 2, spend the rest on comparisons)

Those burn ~$1.45/run and do not change a retainer conversation.

---

## 17. Launch
Launch goal: prove agencies will forward the report to clients and pay for recurring delivery.

**Founder-led launch (Ops)**
- 30 agency DMs from a narrow segment: B2B SaaS SEO/content agencies first.
- Offer: "Send me one client and I will generate the first Friday AI-search report."
- Qualification: they must have at least 5 active clients and already sell SEO/content/PR retainers.
- Success condition: they forward the report to the client or ask to white-label it.

**Launch offer**
- Trial: 14 days (`trialing` + `trialEndsAt` on first workspace), 1 brand, 1 full report, not paid Agency entitlements.
- Agency plan at $249/mo.
- Annual founder plan: $2,490/year for first 25 agencies, locked for 12 months (**Ops**).
- Done-with-you setup for the first 20 paid agencies (**Ops**).

**Website (Shipped)**
- Hero is the PDF, not a dashboard screenshot.
- Sample report at `/report` before signup.
- Pricing page anchors on Agency; three cards + Enterprise note.
- Main CTA: "Send a Friday report."
- No `/playbooks` site pages.

---

## 18. Complete product (not an MVP)

### 18.1 Marketing site

**Shipped primary IA**
- `/` landing
- `/pricing` — 3 plan cards + add-on note + Enterprise contract note + FAQ (6 questions)
- `/report` sample PDF viewer (public, anonymized)
- `/login` `/signup` (noindex, follow)
- Legal: `/legal/privacy` `/legal/terms` `/legal/dpa` `/legal/security` `/legal/subprocessors` `/legal/retention` `/legal/cookies` `/legal/disclaimer`

**Shipped commercial SEO pages (indexable; not playbooks)**  
`/for-seo-agencies` `/for-pr-agencies` `/white-label-ai-visibility-reports` `/ai-visibility-report-template` `/geo-reporting-for-agencies` `/ai-search-reporting-for-agencies` `/alternatives/otterly` `/alternatives/profound` `/compare/peec` `/compare/ai-rank-lab` `/compare/aeo-vision`

**Not shipped**
- `/playbooks` or `/playbooks/*`
- ROI calculator

Marketing message hierarchy:
1. The Friday AI-search report your client actually reads.
2. Track buyer questions across ChatGPT, Gemini, Grok, and AI Overviews.
3. Send a white-label PDF with who won, where you were missing, and what to do next.
4. Built for agencies managing multiple clients.

### 18.2 App

| Area | Status | What it does |
|---|---|---|
| **Command Center** | **Shipped** Agency+ | Portfolio health, risk, pipeline, opportunities, ROI hours saved |
| **Home** | **Shipped** | Agency+: Command Center. Trial/Starter: lighter Home (brands, runs, pipeline, actions; no risk/opportunity rollups) |
| **Reports** `/app/reports` | **Shipped** Agency+ weekly queue | Pipeline + send queue; Studio bulk approve/send |
| **Risks** `/app/risks` | **Shipped** Agency+ | Stable / Watch / At risk from stored reports |
| **Opportunities** `/app/opportunities` | **Shipped** Agency+ | Upsell cards; copy recommendation; mark planned |
| **Brands** | **Shipped** | List, add, duplicate, archive. Logo, site, competitors, vertical, client owner |
| **Brand home** | **Shipped** | Latest score, rec score, trend, last PDF, cadence, top missing |
| **Prompts** | **Shipped** | 20-set editor, 4+4+4+4+4 mix, vanity reject, generate pack |
| **Runs** | **Shipped** | Queue, per-engine status, retry failed engine, extra-run meter |
| **Report** | **Shipped** | HTML viewer, suggested email, approval, download, share link, revoke/rotate, CC, send |
| **History** | **Shipped** Agency+ | PDFs, MoM sparkline, CSV export |
| **Client link** `/r/[token]` | **Shipped** | Read-only, agency-branded, no login, 90-day expiry, open tracking, revoke, noindex |
| **Members** | **Shipped** Agency+ | Owner invites only. Roles: owner, admin, member. Seat cap includes pending invites |
| **Brand kit** | **Shipped** | Logo, color, footer, Prepared by |
| **Billing** | **Shipped** | Plan, usage, Dodo portal, cancel at period end, add-ons, upgrade prompts |
| **Settings** | **Shipped** | Workspace, Domains (getcitebrief.com + Studio custom sender DNS checklist), timezone (cron), default engines, Slack, hours-saved (Agency+) |
| **Onboarding** | **Shipped** | 6 fields → generated 20 → first run → PDF → send/share |
| **Client portal archive** | **Later** | Listed on Studio pricing copy; no dedicated portal |
| **Command palette ⌘K** | **Later** | |
| **SSO** | **Later** | Enterprise sales promise |

Polish requirements (still the bar):
- Every empty state must lead to revenue behavior: add brand, generate prompts, run report, send report, upgrade.
- Every plan limit must show the upgrade value, not just an error.
- Every generated report should have a send-to-myself path on Agency+ (send `to` defaults to the signed-in user).
- Every client-facing link must hide CiteBrief branding unless the plan requires CiteBrief sender.
- Account managers must never see raw technical failures before seeing whether the report can still ship.
- Dashboard summaries must reuse stored report data. Do not create hidden AI spend on Home.

Report approval workflow **Shipped** (Agency+):
1. Report is generated (`needs_review`).
2. Account manager reviews findings and suggested email.
3. Report is approved.
4. Report is sent (email) or shared (client link). Send is blocked until approved.

### 18.2.1 Dashboard / Command Center
**Shipped** for paid Agency / Studio / Enterprise. Trial and Starter get a **lighter Home** only. `/app/reports`, `/app/risks`, and `/app/opportunities` show an upgrade prompt when the plan does not allow the module.

The dashboard is the paid product surface that justifies Agency at $249.

**Primary dashboard promise**

> In five minutes, an agency owner or account manager should know what changed this week, which clients need attention, which reports are ready to send, and which client conversations can create revenue.

**Default layout (Shipped)**
- Top strip: clients monitored, average named, at risk, opportunities, hours saved; then reports ready, reports sent, failed/partial (Agency+).
- Portfolio table (“This week”): brand, owner, risk, named, recommended, week-over-week change, pipeline, next action.
- This week’s actions; opportunity cards with copy + mark planned; clickable pipeline strip → `/app/reports?stage=`.

**Not shipped as a distinct chrome:** dedicated right-rail + bottom-area three-pane layout from the original mock. Function is on Home plus `/app/reports` `/app/risks` `/app/opportunities`. Sidebar: Home, Brands, Reports, Opportunities, Risks, Settings.

**Dashboard KPIs (Shipped, stored data only)**

| KPI | Meaning |
|---|---|
| Portfolio visibility | Average named rate across active clients |
| Clients monitored | Active client brands |
| Reports ready | Latest report exists and is not sent (`needs_review` + `ready_to_send`) |
| Reports sent | Latest report has `sentAt` |
| Clients at risk | At-risk count from risk rules |
| Opportunities found | Monetizable recommendations from latest reports |
| Estimated hours saved | Reports generated × workspace minutes (45–90, default 60) |
| Failed / partial | Latest run `failed` or `partial` |
| Full-use COGS | **Later** on owner Home; **Shipped** as internal admin per-run estimate |

**Client portfolio table (Shipped)**  
Brand, owner, risk, named, recommended, week-over-week change, pipeline, next action CTA.  
**Later** on Home: competitor-leader column (the value is computed for risk rules and Studio CSV, not shown on the Home table).

**Risk rules (Shipped, from stored report/run data)**
- `At risk`: visibility drops ≥25%, zero recommendations, report failed, send overdue after scheduled send day, or competitor leads ≥50% of prompts.
- `Watch`: drop 10%–24%, partial report, missing sources, named but rarely recommended, no prompts, no report, or unsent.
- `Stable`: otherwise (typically sent, no major drop).

Risk labels explain why (examples): "Dropped from 9/20 to 5/20 named." / "Competitor leads 12 buyer questions." / "Report ready but not sent." / "No recommendations this week."

**Revenue opportunities (Shipped keys)**  
`geo_package`, `comparison_page`, `source_refresh`, `pr_placement`, `technical_seo`.  
Each card: client, type, evidence, recommended service, suggested wording, Small/Medium/High, CTA open report / copy / mark planned.

**Later opportunity types** from the original list (not separate keys): pricing/proof update, review/listing authority as first-class types.

**This week’s actions (Shipped)**  
Generated from workflow state: generate prompts, run report, review partial, approve, send, rerun failed engine, follow up at risk, create recommendation from an opportunity.

**Report pipeline (Shipped)**

| Stage | Meaning |
|---|---|
| Not configured | Brand exists but no prompt set |
| Ready to run | Prompts exist, no report |
| Running | Queued/running |
| Needs review | Report generated, not approved |
| Approved (`ready_to_send`) | Approved, not sent |
| Sent | `sentAt` set |

Home and `/app/reports` show counts; clicking a stage filters `/app/reports?stage=`.

**Empty states (Shipped)**
- No brands: one CTA — Add a brand → `/app/onboarding` (no second empty-home CTA).
- One brand, no report: generate prompts, run report, and view sample.
- Reports exist, no opportunities: a short explanation, not a blank panel.

**Agency ROI panel (Shipped)**  
Reports generated / sent, hours saved, brands, opportunities. Owners set 45–90 minutes saved per report in workspace settings.

**Plan behavior (Shipped)**
- Trial / unpaid: lighter Home, 1 brand cap, upgrade prompts on Reports / Risks / Opportunities.
- Starter: lighter Home, no portfolio health depth, no risk/opportunity rollups, no weekly send queue.
- Agency: full Command Center.
- Studio: Agency plus bulk approve/send and portfolio CSV export.
- Enterprise: same gates as Studio in code until custom dimensions exist.

**Dashboard filters (Shipped on Agency+ lists)**  
Owner, risk, pipeline, opportunity type, brand, sent/not sent.  
**Later:** report cadence as a dedicated filter.

**No hidden cost rule (Shipped)**  
Dashboard load does not trigger new model calls.

### 18.3 Engine + report engine
**Shipped**
- Plan-selectable sources: ChatGPT, Gemini, Grok (Gateway); AIO via Browser Rendering. Claude adapter kept but not plan-selectable
- **Agency / Studio default run:** ChatGPT + Gemini + Grok + AIO. Soft-fail **3/4**.
- Trial first report: **ChatGPT + Gemini only** (2/2 to ship), **5 prompts**
- Claude paused on all plans for now. Claude `max_tokens` 800 + `max_uses` 1 remain in adapter code
- Extra Grok / engine volume on Studio, Enterprise, or premium pack
- 24h D1 `engine_cache` on identical prompt+engine
- HTML report + PDF on R2
- Email to agency and optional client CC (Agency+)
- Slack incoming webhook (Agency+)
- Store raw engine responses, timestamp, source URLs, extraction confidence, AI Gateway request id
- Default report hides raw outputs; audit drawer in app
- Live-configured engine failures throw; they do not stub-succeed

**Later / Ops:** Gateway spend limits; Workers AI extractor/writer; writer "technical mode."

### 18.4 Billing product
**Shipped:** Starter / Agency / Studio / Enterprise; extra brand / seat / run; premium pack flag; unpaid/trial 1/1/1; no free forever; no recurring weekly send until paid; no Studio engines in unpaid/trial; dunning on failed subscription; cancel at period end; PDFs 90 days after end; upgrade prompts; annual = 10 months; usage screen.

**In-app billing UI (Shipped):** `/app/settings/billing` highlights **one** plan (badge Current plan / After trial / Selected — never two green cards). Add-on purchase is hidden until paid `active`. Public `/pricing` stays three cards + Enterprise note; the in-app plan grid includes Enterprise at the $1,499 floor.

**Plan-change metering (Shipped):** When a workspace changes paid plan mid-period (e.g. Starter → Agency), `subscriptions.plan_metering_since` resets. Monthly recheck usage and “extra at $9” labels only count runs created on/after `max(start of calendar month, plan_metering_since)` under the **current** plan softCap. Pre-upgrade runs do not consume the new plan’s monthly recheck pool. “N extra at $9” shows only for runs that settled a real Dodo-metered extra (`extra_run` + `billed_at`) in that window — never from a stale lifetime `extra_runs` counter. Agency truth remains: Friday included slot, manuals from the monthly recheck pool, no silent extras.

Revenue moments (still the intended prompts): 3rd Starter brand → Agency; weekly on Starter → Agency; custom sender → Studio; 11th Agency brand → extra brand or Studio; 4th Agency seat → extra seat or Studio; more Grok / engine volume → pack or Enterprise; custom/SSO/SLA → Enterprise; frequent reruns → extra run meter.

### 18.5 Admin (internal)
**Shipped** at `/app/admin` + `/api/internal/admin/*` (Bearer `INTERNAL_ADMIN_SECRET`; production never accepts stub/`dev-admin`):
- Impersonate workspace
- COGS per run (estimate)
- Failed webhook replay
- Engine failure counts + top failing prompts (`/api/internal/admin/engines`)
- Plan usage by workspace (`/api/internal/admin/usage`)
- Audit log viewer

**Later:** report quality review queue for early customers as a dedicated queue UI.

### 18.6 What “complete” still is not
Not a GEO optimizer. Not a content factory. Not Peec.  
If we add actions later, they stay checklists on the report, not a CMS.

### 18.7 Product quality bar
The product can seriously generate revenue only if these are true:

- First PDF feels expensive: typography, spacing, hierarchy, and client-safe language are excellent.
- First setup feels fast: one client can be live before the buyer loses attention.
- Reports are reliable: a flaky engine does not block Friday delivery.
- White-label feels real: client links, PDF footer, email sender, logo, and colors align.
- Actions are useful: each report tells the agency what to do next, not just what happened.
- Multi-client management is calm: agencies can scan a book of clients without opening every brand.
- Billing is transparent: agencies know when and why they are being charged.
- Trust is inspectable: raw answers and sources are available when someone challenges a finding.

---

## 19. Information architecture

```
/                       marketing (index)
/pricing                3 cards + Enterprise note (index)
/report                 sample (index)
/legal/*                legal (index)
/for-* /compare/* /alternatives/*   commercial SEO (index)
/r/[token]              public client report (noindex)
/signup  /login         noindex
/invite/[token]         noindex
/app                    Home (Command Center or light)
/app/brands
/app/brands/[id]
/app/brands/[id]/prompts
/app/brands/[id]/runs/[runId]
/app/brands/[id]/reports/[reportId]
/app/brands/[id]/history
/app/reports            pipeline and send queue
/app/opportunities
/app/risks
/app/settings
/app/settings/brand-kit
/app/settings/members
/app/settings/billing
/app/admin              internal
/api/auth/*             Better Auth
/api/checkout           Dodo
/api/webhooks/dodo
```

No `/playbooks`.

---

## 20. Design system — crisp 2026, not generic AI slop

X in 2026 is done with: purple-blue gradients, glassmorphism, floating 3D dashboards, glow blobs, “Unlock / Supercharge / Seamless”.  
What still looks expensive: **Linear / Vercel / Swiss editorial**. One typeface family in the app, one serif on the marketing headline only. Show the actual PDF.

### 20.1 Personality
Quiet instrument for agencies. Paper + ink, not neon cockpit.  
Dark marketing optional; **app is light**. Clients print these.

### 20.2 Type
| Use | Face | Size | Notes |
|---|---|---|---|
| Marketing H1 | Newsreader or Instrument Serif | 56–72 | max ~10 words |
| App UI | Inter or Geist | 14 body, -0.2px | never mix 4 fonts |
| Numbers / score | Geist Mono or IBM Plex Mono | 12–28 | tabular nums |
| PDF body | Inter | 11–12 | print-safe |

### 20.3 Color
```
bg            #FAFAF8   warm paper, not #FFF
surface       #FFFFFF
line          #E8E6E1
text          #171717
muted         #737373
accent        #0B3D2E   ink green (agency-replaceable)
named         #0B3D2E
missing       #9A3412   rust, not candy red
pending       #B45309
```
No purple. No gradient mesh. Accent comes from the agency kit on PDFs and client links.

### 20.4 Radius, space, motion
- Radius: 8px controls, 12px cards, 16px marketing panels. Not 24px pills everywhere.
- 8px grid. Section padding 64–96 marketing, 24–32 app.
- Motion: 150–200ms, ease-out, opacity + 4px. No bounce, no page-wide parallax.
- Hairline borders over shadows. Shadow only on floating menus: `0 8px 24px rgba(0,0,0,.06)`.

### 20.5 Components

**Marketing**
- Nav: logo left, Pricing + Sample report + Sign in, CTA “Send a Friday report” right
- Hero: serif H1 from §18.1 (“The Friday AI-search report your client actually reads.”), supporting copy from the same hierarchy, two CTAs (**Send a Friday report** / **View sample report**). Right side = PDF preview (not a dashboard)
- Pricing: 3 cards, Agency outlined as recommended, monthly/annual toggle
- FAQ accordion (6 questions in `src/lib/pricing-faq.ts`)
- Footer: product + legal (privacy, terms, security, DPA). No Status link. No playbooks.

**App shell**
- Sidebar **240px**, persistent. Logo, Home, Brands, Reports, Opportunities, Risks, Settings. Bottom: workspace + avatar
- Primary action **top right**
- Tables: row height **48px**, sticky header, mono scores
- Empty states: one line + CTA
- Toasts: bottom, 3s
- Command palette **Later** (`⌘K` jump to brand)

**Report viewer**
- Full-bleed paper on `#FAFAF8`
- Top: Download PDF · Copy client link · send / CC (plan-gated)
- Score as a big mono number, not a gauge chart

**Onboarding (3 steps, one column)**
1. Brand, URL, incumbents
2. Generated 20, editable
3. Running… then PDF

**PDF itself**
- Letter, 0.7" margin
- Agency logo 24px height
- Cover score huge
- Prompt blocks with 1px rules, not cards
- Footer: “Prepared by {agency} · {date}”

### 20.6 Stack for UI
- Next.js App Router + Tailwind v4
- **shadcn/ui** (Button, Dialog, Dropdown, Table, Tabs, Toast, Form)
- **Base-ui / Radix** underneath
- Icons: **Lucide**, 16–18px, 1.5 stroke
- Charts: **Recharts** only for MoM sparkline. No 3D.
- PDF/report preview: stored HTML from R2 (not a required react-pdf dependency)
- Fonts: `next/font` (Geist + Newsreader)

### 20.7 States every screen must have
Default · Loading (skeleton, not spinner wall) · Empty · Error · Partial (4/5 sources) · Success.

### 20.8 Copy voice
Specific. No “unlock AI search”.  
Live landing H1: **“The Friday AI-search report your client actually reads.”**  
SEO/meta title still uses **“The Friday PDF your client actually reads.”**  
Nav and hero primary CTA: **Send a Friday report**. Secondary: **View sample report**.  
Signup page heading: **Start the first report**.  
In-app: verbs on buttons (Run, Send, Copy link).

### 20.9 Anti-patterns (ban)
Purple-blue gradient · glass cards · floating 3D dashboard in hero · orb/blob backgrounds · 5-column feature grids · “Seamless / Supercharge / Next-gen” · dark app with neon charts · custom cursor · auto-playing hero video.

### 20.10 Quality bar
Lighthouse marketing > 90. Mobile landing works. App can be desktop-first (1280+). PDF readable printed B&W.

---

## 21. Technical notes (Workers + Next)
- `@opennextjs/cloudflare` + Wrangler. Compatibility date 2026-09-12. `nodejs_compat`.
- KV binding for ISR / Better Auth / **route rate limits**. Production **fail-closed** if KV is missing on rate-limited routes (503).
- Bindings read with `getCloudflareContext()` — never `process.env.DB`.
- Queue consumer is **this Worker** (`worker.ts` `queue()`). Next app only `env.RUNS_QUEUE.send()`.
- Logos are HTTPS URLs on the brand kit (not R2). Report HTML/PDF objects live in R2.
- Preview: `opennextjs-cloudflare build && opennextjs-cloudflare preview` (`npm run preview`).
- Cron: `"0 * * * *"`; `runFridayCron` enqueues when the workspace timezone is Friday 06:00 (Starter: first Friday of the month).

### 21.1 Email (Shipped)
Cloudflare Email Service via Wrangler `send_email` binding **`EMAIL`**. Default From: `CiteBrief <auth@getcitebrief.com>` (`CF_EMAIL_FROM`). Templates in `src/emails/`. System sending domain is always **`getcitebrief.com`**.

| Mail | Chrome |
|---|---|
| Verify email, magic link, invite, dunning, deletion | CiteBrief mark + getcitebrief.com footer |
| Friday report send and client CC | Agency logo/name, kit accent, prepared-by footer (no CiteBrief chrome) |
| Trial one-shot client CC | CiteBrief chrome + getcitebrief.com From (not agency white-label) |
| Friday queued / report-ready (internal) | CiteBrief chrome |

Production without `EMAIL.send` **fails closed** (throw). Local `next dev` stubs.

**Domain management (Shipped):** Settings → Domains shows CiteBrief system domain status and Studio custom sender. Studio saves display name + hostname; owners attest SPF / DKIM / DMARC / Cloudflare Email onboard. Custom From `Name <reports@{domain}>` only when the checklist is complete; otherwise Studio still uses getcitebrief.com (optional display name). Automatic DNS polling is **Later**. getcitebrief.com onboard remains **Ops** (Cloudflare Email Sending dashboard).

Studio custom sender: display name + `reports@{sender_domain}` when custom sender is allowed **and** domain verified.

### 21.2 Security (Shipped)

**Headers:** CSP (`frame-ancestors 'none'`; production script-src `'self' 'unsafe-inline'` without `unsafe-eval`; `unsafe-eval` only in development), `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, `X-Content-Type-Options`, HSTS.

**Worker secret gate:** production with stub/`dev-admin` `BETTER_AUTH_SECRET`, `INTERNAL_ADMIN_SECRET`, `INTERNAL_PROCESS_SECRET`, or `CRON_SECRET` returns 503 for all traffic except health.

**Billing:** production never stub-checkouts or persists fake paid rows. Missing Dodo keys → 503.

**Engines:** live-configured providers that error fail the engine. Deterministic stubs only when the engine is not live-configured (local/dev).

**Rate limits (KV):**

| Bucket | Limit | Window |
|---|---|---|
| auth | 30 | 1 min |
| run create | 10 | 1 hour |
| report send | 20 | 1 hour |
| invite | 10 | 1 hour |
| public report token | 60 | 1 min |
| internal | 30 | 1 min |
| export | 5 | 1 hour |
| share manage | 20 | 1 hour |
| billing | 20 | 1 hour |

Better Auth also rate-limits (window 60s, max 20).

**Roles:** owner (billing, invites, members); owner/admin (workspace settings); member (operate brands/reports). Impersonation bypasses role checks for support.

---

## 22. Indexation

Canonical origin: `https://getcitebrief.com`. Sitemap is `INDEXABLE_PATHS` only.

| Surface | Index | Follow |
|---|---|---|
| `/`, `/pricing`, `/report`, legal, commercial SEO pages | Yes | Yes |
| `/login`, `/signup` | No | Yes |
| `/app/*`, `/api/*`, `/r/*`, `/invite/*` | No | No (`robots.txt` disallow) |

---

## 23. Highest-level launch bar

CiteBrief is only ready for a premium public launch when these are true.

### 23.1 Product proof
- A new agency can create a workspace, add one client, generate 20 prompts, run the first report, and share it in under 8 minutes.
- The sample report is good enough to be the homepage hero and the sales demo.
- The report can be sent to a real client without a disclaimer that the product is early.
- Agency Home feels worth $249: portfolio health, client risk, report pipeline, weekly actions, upsell opportunities, and hours saved without opening every brand.
- Every report has inspectable evidence: engine, timestamp, source URLs, raw answer drawer, and AI Gateway request id when available.
- Partial failure still feels professional: 4/5 core sources ship with a clear note.

### 23.2 Commercial proof (Ops)
- At least 10 agencies have received a generated report.
- At least 5 agencies forwarded it to a client or asked to white-label it.
- At least 3 agencies gave pricing feedback on $249 Agency.
- At least 1 agency pays or verbally commits before broad launch.
- Free trial stays capped to 1 brand, 5 prompts, 1 full report, ChatGPT + Gemini only, no recurring weekly send until paid.
- Free trial COGS stays under $4/trial on average (intended ChatGPT+Gemini 10 calls ≈ $0.14; do not run Claude on trial).

### 23.3 Technical proof (Ops)
- `npm test`, `npm run lint`, and `npm run build` pass before every deploy.
- Migrations through **0012** applied on production D1.
- OpenNext preview runs with D1, KV, R2, Queue, Browser Rendering, and EMAIL bindings configured.
- AI Gateway live calls verified for ChatGPT, Gemini, Grok, extractor, and writer.
- Dodo live checkout, webhook idempotency, portal, cancellation, and failed-payment handling verified.
- Friday cron verified across at least 3 tenant timezones.
- Run COGS and engine failures visible in internal admin.
- Gateway spend limits configured by plan, workspace, and engine before public launch.
- Dashboard/risk/opportunity views do not trigger hidden model calls on page load.

### 23.4 Trust proof
- Privacy and terms pages clearly state that reports reflect third-party AI answers and may be incomplete. **Shipped.**
- Client links expire, revoke, and do not require auth. **Shipped.**
- Single-domain Better Auth on `getcitebrief.com`. **Shipped.**
- Optional domains only redirect. **Shipped** in Worker.
- Report emails have a tested sender identity and do not land in spam during pilot. **Ops.**

### 23.5 Brand proof
- The app feels calm and operational, not like a generic AI landing page.
- The PDF prints cleanly in black and white.
- The homepage shows the actual report, not decorative dashboard art.
- All plan limits explain the upgrade value.
- Empty states push toward revenue behavior: add brand, generate prompts, run report, send report.
