# PRD: CiteBrief
**AI-search visibility report for agencies**  
Version 2.0 · 12 Sep 2026 · Domain: getcitebrief.com · Next.js on Cloudflare Workers (OpenNext) · Better Auth · Dodo Payments

---

**Canonical domain:** **Primary:** `getcitebrief.com` (optional redirect from `citebrief.xyz`) (~$11.08 Porkbun at-cost). `citebrief.com` is taken. Optional cheap redirect: `getcitebrief.com` (~$2.04).

## 1. One-liner
Agencies enter a brand + 20 buyer questions. CiteBrief asks ChatGPT, Perplexity, Gemini, and Google AI Overviews. Every Friday it emails a white-label PDF the client can read.

The weekly artifact is the PDF. The product around it is a full agency workspace: brands, prompts, history, members, client links, billing, white-label.

---

## 2. Problem
SEO/PPC agencies sell GEO/AEO on $3k–$5k retainers. Trackers are either $29 with no client-ready export, or $189–$399 that still leave the AM writing slides. 40–80 hours/month of copy-paste.

## 3. Who
**Buyer:** agency owner / account lead (5–40 clients).  
**User:** account manager.  
**Reader:** client CMO. No jargon.

Not for indie founders who want a score (Otterly $29).

---

## 4. Jobs
1. Prove we looked at AI search this period.
2. Named or cited — yes/no.
3. Who won the answer.
4. Three next actions for next week.

---

## 5. Auth — Better Auth
Use `better-auth` + `better-auth-cloudflare` on the Worker. D1 is the source of truth. Optional KV for rate-limit / session cache.

**v1 methods**
- Email + password
- Magic link (Resend)
- Google OAuth

**Rules**
- Init auth **inside the request** (`c.env.DB`). Never a global D1 binding.
- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` as Wrangler secrets.
- Workspace created on first verified login.
- Invite flow later (Studio). v1 = one owner per workspace.

**Packages:** `better-auth`, `better-auth-cloudflare`, `@better-auth/drizzle-adapter`, `drizzle-orm`.

---

## 6. Payments — Dodo
Dodo has a first-party Cloudflare + Hono adapter. Do not use Stripe.

**Products in Dodo dashboard**
| Product | Amount | Interval |
|---|---|---|
| CiteBrief Starter | $149 | month |
| CiteBrief Agency | $199 | month |
| CiteBrief Studio | $399 | month |
| Extra brand | $25 / $39 | month addon |
| Extra run | $6 / $9 | one-time or usage meter |

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
See §18 for the complete feature map. Shipping order is still phased, but the product *is* the full system below, not a PDF-only toy.

Time-to-first-PDF: **< 8 minutes**.

---

## 8. Report spec
Cover: agency logo, client, period, **score X/20 mentioned**.  
Each prompt: Mentioned Y/N per engine, cited URL, who won, 20-word sentence, one next action.  
Close: 3 priorities ranked by “asked often × not mentioned”.

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
              └─ AI Gateway + Workers AI

Better Auth  (better-auth-cloudflare, init per request)
Dodo         (checkout route + /api/webhooks/dodo)
Resend       (auth + report mail)
Cron Trigger Friday 06:00 tenant TZ
```

Create with `npm create cloudflare@latest -- --platform=workers`.  
`nodejs_compat` on. Incremental cache → KV. Static assets ship with the Worker (Workers Static Assets). **Do not use Pages.**

Long jobs (80 engine calls, PDF) run in **Workflows / Queue**, not inside the Next.js request. The app only enqueues and polls.

---

## 10. Unit economics

**Fixed:** Workers Paid $5 + domain/email ~$2 = **~$7/mo**

**Per brand per run:** 20 × 4 engines = 80 grounded calls + writer + PDF ≈ **$1.45**  
Weekly × 8 brands ≈ **$29 COGS** vs $199 price.

| Plan | List | COGS | Dodo fee | Gross |
|---|---|---|---|---|
| Starter | $149 | $8–12 | ~$7 | ~$130 (87%) |
| Agency | $199 | $30–40 | ~$9 | ~$150 (75%) |
| Studio | $399 | $80–120 | ~$18 | ~$261 (65%) |

100 Agency customers: **$19.9k MRR**, ~$4.6k LLM, ~$935 Dodo, CF still near included. **~72% gross.**

Caps: 2 manual re-runs / brand / week on Agency. Hard-stop at 3× included calls.

---

## 11. Pricing

| Plan | Price | Brands | Prompts | Cadence |
|---|---|---|---|---|
| Starter | $149/mo | 3 | 20 | Monthly |
| **Agency** | **$199/mo** | **8** | 20 | **Weekly** |
| Studio | $399/mo | 20 | 30 | Weekly |

Annual = 10 months. Trial: 14 days, 1 brand, 1 full run.

Feature Agency $199. Do not ship $29.

---

## 12. Competitors
Otterly $29–$489 (~$0.8M). Peec $95–$495 ($10M+ ARR). Profound $399–$5k ($1B val). Semrush/Ahrefs modules.  
Win on white-label Friday PDF, not depth.

---

## 13. Metrics
Time to first PDF · trial-run rate · 14d paid · brands/workspace · PDFs CC’d to client · m2 retention · COGS/report.

North star: **paid workspaces that sent a PDF to a client this month**.

---

## 14. Risks
Engine drift → official APIs, store raw.  
AIO layout change → fail soft, ship 3-engine PDF.  
Cost spike → mid models, 24h cache, caps.  
“Not Peec” → stay the report layer.

---

## 15. Build week
Week 1 Foundation: Next.js + OpenNext Worker, Better Auth, D1, empty shell UI  
Week 2 Brands, prompts, engine fan-out, first PDF  
Week 3 Dodo, caps, cron, white-label, send  
Week 4 App completeness: history, MoM, members, client link, settings  
Week 5 Marketing site + PDF viewer + onboarding  
Week 6 Hardening: usage meters, failed-engine fallback, billing portal

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

## D. Engine wrapper (send this, not the raw 20)

Same user prompt every engine. System prompt changes by engine.

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

**AIO (browser):** paste the prompt in the search box only. No system prompt. Store the overview text + listed links.

---

## E. Extractor (per prompt × engine)

Run on Workers AI / Flash. Cheap. Deterministic.

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
10 agency DMs: one brand, one Friday PDF, they must forward it.  
Price on page: $199 Agency. Hero is the PDF, not a dashboard screenshot.

---

## 18. Complete product (not an MVP)

### 18.1 Marketing site
- `/` landing
- `/pricing` 3 plans + FAQ
- `/report` sample PDF viewer (public, anonymized)
- `/login` `/signup`
- `/legal/privacy` `/legal/terms`

### 18.2 App
| Area | What it does |
|---|---|
| **Home** | This week’s runs, score change, “needs send” |
| **Brands** | List, add, archive. Logo, site, competitors, vertical |
| **Brand home** | Latest score, sparkline, last PDF, next Friday |
| **Prompts** | 20-set editor, templates, lock mix 4+4+4+4+4, reject vanity |
| **Runs** | Queue, live status per engine, retry failed engine only |
| **Report** | In-app PDF viewer, download, copy share link, CC client |
| **History** | All PDFs, MoM mentioned/recommended, who-won chart |
| **Client link** | Read-only page, agency-branded, no login, 90-day expiry |
| **Members** | Invite AM (Agency+). Roles: owner, member |
| **Brand kit** | Logo, color, footer, “Prepared by” |
| **Billing** | Plan, usage (brands, runs), Dodo portal, invoices |
| **Settings** | Workspace, timezone (cron), default engines, email sender name |
| **Onboarding** | 6 fields → generated 20 → first run → PDF |

### 18.3 Engine + report engine
- 4 engines v1, Claude/Grok as Studio add-on
- 24h cache on identical prompt+engine
- Soft-fail: 3 of 4 engines still ship the PDF
- Writer + extractor as specified in Prompts
- HTML report + PDF (R2)
- Email to agency; optional client CC
- Slack incoming webhook (Agency+)

### 18.4 Billing product
- Starter / Agency / Studio
- Extra brand addon
- Extra run meter (Dodo usage)
- Trial 14d, 1 brand, 1 full run
- Dunning email on `subscription.failed`
- Cancel at period end; PDFs stay 90 days

### 18.5 Admin (internal)
- Impersonate workspace (support)
- COGS per run
- Failed webhook replay

### 18.6 What “complete” still is not
Not a GEO optimizer. Not a content factory. Not Peec.  
If we add actions later, they stay checklists on the report, not a CMS.

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

