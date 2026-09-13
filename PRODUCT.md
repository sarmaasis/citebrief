# PRD: CiteBrief
**Client-ready AI-search reporting for agencies**  
Version 2.2 · 13 Sep 2026 · Domain: getcitebrief.com · Next.js on Cloudflare Workers (OpenNext) · Better Auth · Dodo Payments · Cloudflare AI Gateway

---

**Canonical domain:** `getcitebrief.com` (~$11.08 Porkbun at-cost). `citebrief.com` is taken. Optional redirect: `citebrief.xyz` (~$2.04).

## 1. One-liner
Agencies enter a client brand and 20 buying questions. CiteBrief checks ChatGPT, Perplexity, Gemini, and Google AI Overviews, then sends a polished white-label Friday report that proves whether AI search is sending buyers to the client or to competitors.

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

**Revenue thesis:** if CiteBrief saves an agency 6-10 reporting hours/month and helps them defend or upsell even one $3k+ retainer, $149-$499/month is an easy operating expense.

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
Use `better-auth` + `better-auth-cloudflare` on the Worker. D1 is the source of truth. Optional KV for rate-limit / session cache.

Auth is **single-domain first-party auth** on `getcitebrief.com`. Do not implement multi-domain shared auth, cross-domain session sharing, or a separate auth subdomain in v1.

**v1 methods**
- Email + password
- Magic link (Resend)
- Google OAuth

**Rules**
- Init auth **inside the request** (`c.env.DB`). Never a global D1 binding.
- `BETTER_AUTH_URL` is the canonical public origin, e.g. `https://getcitebrief.com`.
- Better Auth `baseURL` and `trustedOrigins` must both resolve to the single canonical origin.
- Do not use `BETTER_AUTH_TRUSTED_ORIGINS` for multiple app domains.
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` as Wrangler secrets.
- Workspace created on first verified login.
- Invite flow later (Studio). v1 = one owner per workspace.
- Optional domains like `citebrief.xyz` must 301 redirect to `getcitebrief.com` and must not set or share auth cookies.
- Client report links under `/r/[token]` are public token links, not authenticated cross-domain sessions.

**Packages:** `better-auth`, `better-auth-cloudflare`, `@better-auth/drizzle-adapter`, `drizzle-orm`.

---

## 6. Payments — Dodo
Dodo has a first-party Cloudflare + Hono adapter. Do not use Stripe.

**Products in Dodo dashboard**
| Product | Amount | Interval |
|---|---|---|
| CiteBrief Starter | $149 | month |
| CiteBrief Agency | $249 | month |
| CiteBrief Studio | $499 | month |
| Extra brand | $29 / $39 | month addon |
| Extra run | $9 | one-time or usage meter |

**Worker flow**
1. Logged-in user hits `GET /api/checkout?plan=agency`
2. `@dodopayments/hono` Checkout → Dodo hosted page
3. Return URL `/app/billing/success`
4. Webhook Worker verifies signature (`DODO_PAYMENTS_WEBHOOK_KEY`)
5. Handle: `subscription.active` · `subscription.renewed` · `subscription.cancelled` · `subscription.failed` · `payment.succeeded`
6. Idempotent on webhook event id (D1 unique)

**Secrets:** `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_KEY`, `DODO_PAYMENTS_ENVIRONMENT` (`test_mode` | `live_mode`)

**Fee (US cards):** 4% + $0.40 + 0.5% subscription ≈ **4.5% + $0.40**. Tax included in Dodo. India local cheaper.

Packages: `dodopayments`, `@dodopayments/hono`

---

## 7. Product scope — full product, not an MVP
See §18 for the complete feature map. Shipping order is phased, but the product must feel complete in the places that affect willingness to pay:

- The first report must look polished enough to forward to a client.
- The account manager must understand what changed without reading raw engine output.
- The agency must be able to add multiple client brands quickly.
- The owner must see plan limits, usage, invoices, and expansion paths clearly.
- Client-facing pages must look like the agency, not CiteBrief.

Time-to-first-PDF: **< 8 minutes**.

Time-to-second-client: **< 3 minutes** once the workspace is configured.

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
- Never say GEO, AEO, LLM, embeddings, prompt, token, or model unless the agency chooses "technical mode."
- Do not include raw AI text in the default PDF.
- Do not mention failed engines unless fewer than 3 engines succeeded.
- If the client is doing poorly, say it plainly but with next steps.

---

## 9. Architecture — Next.js on Workers (no Pages)

```
Next.js 15/16  —  @opennextjs/cloudflare
        │
        ├─ App Router UI (marketing + app)
        ├─ Route Handlers / Server Actions
        └─ Worker bindings via getCloudflareContext()
              ├─ D1
              ├─ KV (Better Auth rate limit + ISR cache)
              ├─ R2
              ├─ Queue
              ├─ Workflows
              ├─ Browser Rendering
              ├─ AI Gateway
              └─ Workers AI

Better Auth  (better-auth-cloudflare, init per request)
Dodo         (checkout route + /api/webhooks/dodo)
Resend       (auth + report mail)
Cron Trigger Friday 06:00 tenant TZ
```

Create with `npm create cloudflare@latest -- --platform=workers`.  
`nodejs_compat` on. Incremental cache → KV. Static assets ship with the Worker (Workers Static Assets). **Do not use Pages.**

Long jobs (80 engine calls, PDF) run in **Workflows / Queue**, not inside the Next.js request. The app only enqueues and polls.

### 9.1 AI Gateway policy
CiteBrief uses **Cloudflare AI Gateway as the AI control plane**. Do not wire product code directly to individual provider API keys.

What goes through AI Gateway:
- OpenAI / ChatGPT-style answer generation.
- Perplexity answer generation.
- Gemini answer generation.
- Studio add-on model calls such as Claude or Grok when enabled.
- Extractor and writer calls when they use Workers AI or another model provider.

What does not go through AI Gateway:
- Google AI Overviews browser capture, because it is a browser-rendered search surface, not an LLM API call.
- Resend, Dodo, auth, storage, and ordinary app APIs.

Configuration:
- Required app secrets: `CF_ACCOUNT_ID`, `AI_GATEWAY_ID`, and a scoped Cloudflare token for AI Gateway / Workers AI access.
- Prefer AI Gateway stored provider keys or unified billing where available.
- If a provider still requires its own credential, store it in Cloudflare AI Gateway configuration, not as a first-class application secret.
- Local development may use deterministic stubs when AI Gateway config is missing.

Gateway responsibilities:
- Analytics by workspace, brand, engine, run, and plan.
- Centralized request logging for debugging and trust.
- Cache repeated prompt+engine calls when freshness allows it.
- Rate limits and spend limits by plan.
- Retries and model fallback for flaky providers.
- Custom metadata on every request: `workspace_id`, `brand_id`, `run_id`, `engine`, `plan`, `prompt_hash`.

Implementation rule:
- All model adapters call a single internal `aiGatewayRequest()` helper.
- No app code should import or read `OPENAI_API_KEY`, `PERPLEXITY_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or `XAI_API_KEY`.
- If direct provider access is temporarily needed during migration, mark it as a dev-only fallback and remove before launch.

---

## 10. Unit economics

**Fixed:** Workers Paid $5 + domain/email ~$2 = **~$7/mo**

**Per brand per run:** 20 × 4 engines = 80 grounded calls + writer + PDF ≈ **$1.45**  
Weekly × 8 brands ≈ **$29 COGS** vs $249 price.

| Plan | List | COGS | Dodo fee | Gross |
|---|---|---|---|---|
| Starter | $149 | $8–12 | ~$7 | ~$130 (87%) |
| Agency | $249 | $30–45 | ~$12 | ~$192 (77%) |
| Studio | $499 | $80–140 | ~$23 | ~$336 (67%) |

100 Agency customers at $249: **$24.9k MRR**, ~$4.5k LLM/PDF COGS, ~$1.2k Dodo, CF still near included. **~77% gross.**

Revenue scenarios:

| Customers | Mix | MRR | Notes |
|---|---|---:|---|
| 25 | mostly Agency | ~$6k | founder-led, proof of demand |
| 100 | Agency-heavy | ~$25k | small SaaS business, support still manageable |
| 300 | Agency + Studio | ~$90k+ | requires support, onboarding, and reliability discipline |

Expansion revenue:
- Extra brand: $39/mo on Agency, $29/mo on Studio.
- Extra weekly run: $9 one-time or metered.
- White-label custom sender/domain: Studio only.
- Additional seats: included up to plan cap, then $15/seat/mo.
- Quarterly strategy export: Studio add-on later, $99/report, only after core retention is strong.

Caps: 2 manual re-runs / brand / week on Agency. Hard-stop at 3× included calls.

---

## 11. Pricing

| Plan | Price | Brands | Prompts | Cadence |
|---|---|---|---|---|
| Starter | $149/mo | 3 | 20 | Monthly |
| **Agency** | **$249/mo** | **8** | 20 | **Weekly** |
| Studio | $499/mo | 20 | 30 | Weekly |

Annual = 10 months. Trial: 14 days, 1 brand, 1 full run.

Feature Agency at $249. Do not ship $29.

**Plan gates**

Starter:
- 3 brands.
- Monthly report cadence.
- CiteBrief sender.
- PDF download and private client link.
- 1 seat.

Agency:
- 8 brands.
- Weekly Friday reports.
- Agency logo/color/footer.
- Client CC sending.
- History and score trend.
- 3 seats.
- Slack webhook.
- Extra brands.

Studio:
- 20 brands.
- 30 prompts/brand.
- Custom sender name/domain.
- Client portal archive.
- Claude/Grok add-on engines.
- 10 seats.
- Priority support.
- Internal COGS and usage export.

**Pricing psychology**
- Starter is for small agencies proving the workflow.
- Agency is the main plan and must look like the obvious choice.
- Studio is for agencies already reselling AI-search reporting across a client book.
- No free forever plan. Free creates hobby usage and support load.

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
Activation:
- Time to first PDF.
- % trials that generate a report.
- % trials that copy/share/send the report.
- Time to second brand.

Revenue:
- Trial-to-paid by plan.
- MRR, expansion MRR, downgrade/cancel MRR.
- Average brands/workspace.
- Extra brand attach rate.
- Annual prepay rate.

Retention:
- m2 logo retention.
- Weekly report send rate.
- Client link opens.
- PDFs CC'd to client.
- Number of consecutive Friday reports per brand.

Cost/reliability:
- COGS/report.
- Engine success rate.
- PDF generation success rate.
- Support tickets per 100 workspaces.

North star: **paid workspaces that sent a PDF to a client this month**.

---

## 14. Risks
Engine drift → official APIs, store raw.  
AIO layout change → fail soft, ship 3-engine PDF.  
Cost spike → AI Gateway spend limits, cache, mid models, plan caps.  
“Not Peec” → stay the report layer.  
Report not trusted → expose sources, raw output audit drawer, and engine timestamps.  
Too much agency setup → 6-field onboarding, reusable prompt packs, duplicate brand.  
Client asks "what do we do now?" → every report ends with prioritized actions.  
Race to cheap tracking → keep white-label, sending, history, and team workflow behind paid plans.

---

## 15. Build week
Week 1 Foundation: Next.js + OpenNext Worker, Better Auth, D1, app shell, marketing shell.  
Week 2 First revenue artifact: onboarding, brand setup, generated 20 prompts, AI Gateway engine fan-out, first polished PDF.  
Week 3 Paid workflow: Dodo checkout/webhooks, plan limits, report download, private client link, white-label logo/color.  
Week 4 Agency repeatability: duplicate brand, history, score trend, Friday cron, report email, client CC.  
Week 5 Team and trust: members, raw output audit drawer, retry failed engine, source links, failed-engine fallback.  
Week 6 Revenue hardening: extra brand/run billing, billing portal, dunning, usage meters, Studio gates, sample report marketing.

---

## 16. Data model
Better Auth: users, sessions, accounts, verifications  
`workspaces` · `workspace_members` · `brands` · `competitors` · `prompts` · `runs` · `run_rows` · `reports` · `subscriptions` (dodo_customer_id, dodo_subscription_id, plan, status) · `webhook_events`

R2: `reports/{workspace}/{brand}/{yyyy-mm-dd}.pdf`

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

**Perplexity Sonar**
```
Give a sourced shortlist for this purchase question. Cite URLs. Rank recommendations.
```

**Gemini + Search**
```
Use Google Search grounding. Return who you would shortlist and which pages support that.
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

Run on Workers AI through AI Gateway, or another low-cost gateway-routed model. Cheap. Deterministic.

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

Here is extracted data for 20 prompts across 4 engines:
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

Those burn $1.45/run and do not change a retainer conversation.

---

## 17. Launch
Launch goal: prove agencies will forward the report to clients and pay for recurring delivery.

**Founder-led launch**
- 30 agency DMs from a narrow segment: B2B SaaS SEO/content agencies first.
- Offer: "Send me one client and I will generate the first Friday AI-search report."
- Qualification: they must have at least 5 active clients and already sell SEO/content/PR retainers.
- Success condition: they forward the report to the client or ask to white-label it.
- Sales call asks: "What would make this report worth adding to your retainer deck?"

**Launch offer**
- 14-day trial, 1 brand, 1 full report.
- Agency plan at $249/mo.
- Annual founder plan: $2,490/year for first 25 agencies, locked for 12 months.
- Done-with-you setup for the first 20 paid agencies.

**Website**
- Hero is the PDF, not a dashboard screenshot.
- Show the sample report before asking for signup.
- Pricing page anchors on Agency.
- Main CTA: "Send a Friday report."

**Early proof points to collect**
- Time saved per report.
- Whether the report was forwarded to clients.
- Whether the agency added it to retainers.
- Before/after screenshots of manual reporting workflow.
- Quotes from account managers, not only founders.

---

## 18. Complete product (not an MVP)

### 18.1 Marketing site
- `/` landing
- `/pricing` 3 plans + FAQ
- `/report` sample PDF viewer (public, anonymized)
- `/login` `/signup`
- `/legal/privacy` `/legal/terms`
- Comparison pages later: `/alternatives/otterly`, `/for-seo-agencies`, `/for-pr-agencies`
- ROI calculator later: report hours saved × clients × loaded AM cost

Marketing message hierarchy:
1. The Friday AI-search report your client actually reads.
2. Track buyer questions across ChatGPT, Perplexity, Gemini, and AI Overviews.
3. Send a white-label PDF with who won, where you were missing, and what to do next.
4. Built for agencies managing multiple clients.

### 18.2 App
| Area | What it does |
|---|---|
| **Home** | This week’s runs, send status, score changes, brands needing attention |
| **Brands** | List, add, duplicate, archive. Logo, site, competitors, vertical, client owner |
| **Brand home** | Latest score, recommendation score, trend, last PDF, next Friday, top missing questions |
| **Prompts** | 20-set editor, templates, lock mix 4+4+4+4+4, reject vanity, industry packs |
| **Runs** | Queue, live status per engine, retry failed engine only, cost estimate |
| **Report** | In-app PDF viewer, download, copy share link, CC client, send test |
| **History** | All PDFs, MoM mentioned/recommended, who-won chart, export CSV |
| **Client link** | Read-only page, agency-branded, no login, 90-day expiry, open tracking |
| **Members** | Invite AM (Agency+). Roles: owner, admin, member |
| **Brand kit** | Logo, color, footer, “Prepared by”, sender identity |
| **Billing** | Plan, usage (brands, runs, seats), Dodo portal, invoices, upgrade prompts |
| **Settings** | Workspace, timezone (cron), default engines, email sender name |
| **Onboarding** | 6 fields → generated 20 → first run → PDF → send/share |

Polish requirements:
- Every empty state must lead to revenue behavior: add brand, generate prompts, run report, send report, upgrade.
- Every plan limit must show the upgrade value, not just an error.
- Every generated report must have a "send test to myself" path.
- Every client-facing link must hide CiteBrief branding unless the plan requires it.
- Account managers must never see raw technical failures before seeing whether the report can still ship.

### 18.3 Engine + report engine
- 4 engines v1 routed through Cloudflare AI Gateway where API-based
- Claude/Grok as Studio add-on through AI Gateway/provider-native routes
- 24h cache on identical prompt+engine via AI Gateway and D1 cache metadata
- Soft-fail: 3 of 4 engines still ship the PDF
- Writer + extractor as specified in Prompts
- HTML report + PDF (R2)
- Email to agency; optional client CC
- Slack incoming webhook (Agency+)
- Store raw engine responses for audit and support
- Store engine timestamp, source URLs, extraction confidence, and AI Gateway request id
- Default report hides raw outputs; audit drawer shows them inside app
- Gateway spend limits prevent runaway manual re-runs
- Gateway analytics feed COGS/report and plan-level usage reporting

### 18.4 Billing product
- Starter / Agency / Studio
- Extra brand addon
- Extra run meter (Dodo usage)
- Trial 14d, 1 brand, 1 full run
- Dunning email on `subscription.failed`
- Cancel at period end; PDFs stay 90 days
- Upgrade prompts at natural moments: 4th brand, weekly cadence, client CC, white-label sender, extra seats
- Annual prepay with 2 months free
- Workspace usage screen shows included vs billable usage before charges happen

Revenue moments:
- User adds 4th Starter brand → upgrade to Agency.
- User wants weekly reports on Starter → upgrade to Agency.
- User wants custom sender/domain → upgrade to Studio.
- User exceeds 8 Agency brands → add extra brand or upgrade Studio.
- User invites 4th Agency teammate → add seat or upgrade Studio.
- User manually re-runs often → extra run meter.

### 18.5 Admin (internal)
- Impersonate workspace (support)
- COGS per run
- Failed webhook replay
- Engine failure dashboard
- Top prompts by failure/cost
- Plan usage by workspace
- Report quality review queue for early customers

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
/                       marketing
/pricing
/r/[token]              public client report
/signup  /login
/app                    home
/app/brands
/app/brands/[id]
/app/brands/[id]/prompts
/app/brands/[id]/runs/[runId]
/app/brands/[id]/reports/[reportId]
/app/settings
/app/settings/brand-kit
/app/settings/members
/app/settings/billing
/api/auth/*             Better Auth
/api/checkout           Dodo
/api/webhooks/dodo
```

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
- Hero: serif headline, one sentence, two CTAs (start trial / view sample PDF). Right side = **real PDF page**, not a fake dashboard
- Logo row only if real
- Bento 2×2: Named / Who won / Next action / Friday send — each cell one artifact
- Pricing: 3 cards, Agency outlined as recommended, monthly toggle
- FAQ accordion, 5 objections
- Footer thin, legal + status

**App shell**
- Sidebar **240px**, persistent. Logo, Home, Brands, Settings. Bottom: workspace + avatar
- Top bar: brand switcher, “Run now”, user
- Primary action **top right** always
- Tables: row height **48px**, sticky header, mono scores
- Status pills: Named / Missing / Running / Failed — color + word, not icon-only
- Empty states: one line + CTA (“Add a brand”, “Generate 20 prompts”)
- Toasts: bottom, 3s, no stack of 6
- Command palette later (`⌘K` jump to brand)

**Report viewer**
- Full-bleed paper on `#FAFAF8`
- Left thumbnails, right page
- Top: Download PDF · Copy client link · CC client
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
- PDF preview: react-pdf or page images from Worker
- Fonts: `next/font` (Geist + Newsreader)

### 20.7 States every screen must have
Default · Loading (skeleton, not spinner wall) · Empty · Error · Partial (3/4 engines) · Success.

### 20.8 Copy voice
Specific. No “unlock AI search”.  
Headline example: **“The Friday PDF your client actually reads.”**  
CTA: **Start the first report** / **View a sample**.  
In-app: verbs on buttons (Run, Send, Copy link).

### 20.9 Anti-patterns (ban)
Purple-blue gradient · glass cards · floating 3D dashboard in hero · orb/blob backgrounds · 5-column feature grids · “Seamless / Supercharge / Next-gen” · dark app with neon charts · custom cursor · auto-playing hero video.

### 20.10 Quality bar
Lighthouse marketing > 90. Mobile landing works. App can be desktop-first (1280+). PDF readable printed B&W.

---

## 21. Technical notes (Workers + Next)
- `@opennextjs/cloudflare` + Wrangler. Compatibility date 2026. `nodejs_compat`.
- KV binding for ISR / Better Auth rate limit.
- Bindings read with `getCloudflareContext()` from `better-auth-cloudflare` examples — never `process.env.DB`.
- Queue consumer is a **separate Worker** or Workflow. Next app only `env.RUNS_QUEUE.send()`.
- Images via Cloudflare Images or R2 public URLs for logos.
- Preview: `opennextjs-cloudflare build && wrangler dev`.
