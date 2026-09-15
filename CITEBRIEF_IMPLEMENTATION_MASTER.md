# CiteBrief — Implementation Master

**Source docs consolidated:**  
- `APP-UPDATES.md`
- `UI-UX-DASHBOARD.md`
- `PAIN-ICP-PRODUCT-LANDING.md`
- `RESEARCH-DEMAND-2026-09.md`

**Rule:** no CiteBrief brand mentions found anywhere. Demand is the job. Build for the job in the threads, not for a GEO dashboard.

**Product direction:** make the running app match the job in the pain / ICP / product / landing research. The app already has brands, runs, PDF, Dodo, Better Auth, Friday cron, and command center. Do not rebuild that. Change what the report means, what the first session asks for, and how the app packages the brief.

---

## 1. Verdict

The category is hot and getting standardized this month. Client demand to agencies is documented. The gap CiteBrief can own is still the same: **a forwardable brief**, not another tracker.

Two things changed since the X-only pass:

1. Trade press, IAB / Marketing Dive this cycle, treats AI visibility measurement as a real industry problem, not a Twitter niche.
2. Agency survey data puts **AI-driven search optimization as the #1 new client request**. Agencies still cannot reliably measure AI-sourced users or conversions.

This is buyer-side demand with a number. It is not “people tweet about GEO.”

**CiteBrief should not be boxed into agencies only.** Marketing homepage may say “built for client teams.” Checkout must not force an identity.

The product should answer:

> The client already asked. The agency does not have a file they can send.

Primary promise:

> A dated, unbranded, forwardable answer to “does ChatGPT mention us, and who did they name instead?”

---

## 2. Current App Starting Point

### Already Shipped

Do not redo:

- Auth, workspaces, trial 14d / 1 brand / 5 prompts / 1 run
- Dodo checkout + webhooks
- Brand + prompt CRUD, generate prompts (Workers AI)
- Queue run pipeline, fail-closed engines
- White-label PDF + `/r/[token]`
- Friday cron, email send on Growth+
- Command Center, opportunities, history
- Engines in PRODUCT: ChatGPT, Gemini, Grok, AIO
- Claude paused
- Perplexity not on Gateway

### Drift Vs The Product To Ship

| Now in code / PRODUCT.md | Should be |
|---|---|
| Plans named Starter / Growth / Agency ($79 / $249 / $599), Growth = 5 brands / 30 prompts | Public names Starter / Teams / Scale. Teams = 8 brands is the sellable book. $79 is fine if you want a cheaper door; do not call $599 “Agency” |
| Landing: “Send a Friday report” → signup | Hero form: email + client domain + 3 competitors + market |
| Prompt gen: “no vanity branded prompts” (copy only) | Prompts stored with `intent` + `branded` flag; score excludes branded |
| Report: Named X of 20, 3 priorities | Page 1 = per-engine table + IAB Presence / Prominence / Portrayal; 5 actions; GSC disclaimer |
| Extractor: named / recommended / who won | Also `cited_urls[]`, `competitors_named[]`, `unavailable` |
| No CSV | Teams+ JSON/CSV export of extractor rows |
| Brand has no market | `market` / locale on brand |
| CTA copy still says “Agency is $249 for 5 brands” | “Teams · 8 clients · every Friday” |
| Perplexity missing | Keep off Gateway if CF cannot bill it; say 3 live + AIO, do not market 4 LLM APIs |

---

## 3. Research Proof

### Agency Demand

AgencyAnalytics 2026 benchmark:

| Stat | Number |
|---|---:|
| Agencies seeing increased demand for AI-driven search optimization | 66% |
| AI Overviews named as top concern | 64% |
| Cannot reliably track users who found them via AI | 48% |
| Cannot attribute conversions across AI journeys | 47% |
| Accurate reporting important for retention | 97% |
| Clients care most about conversions / leads, not traffic | 44% / 22% vs traffic 6% |

Product implication:

1. Visibility — named on buyer prompts
2. Position — how early
3. Citations — used as a source
4. Sentiment — how described

Keep category prompts separate from branded ones. A model repeating a name you typed is not evidence.

### Measurement Standardization

IAB / Marketing Dive:

- 20+ vendors already sell AI visibility measurement.
- Methodologies do not match each other.
- IAB published a framework so buyers can compare: **Presence, Prominence, Portrayal, Persuasion**.

Product implication:

- Disclose method in the PDF appendix.
- Show engines, `n`, unbranded vs branded, date.
- Use IAB 4P labels on page 1 as an optional subtitle: Presence / Prominence / Portrayal.
- Skip Persuasion until click data exists.

### Fresh Industry Proof

Digiday:

- Marketers are scrambling to measure whether AI brings a brand up at all.
- Visibility is platform-specific.
- Product implication: never print one blended “AI score.” Per-engine table is the honest object.

IAB + Marketing Dive:

- 20+ vendors already sell AI visibility measurement.
- Methodologies do not match each other.
- IAB framework centers on the four Ps of visibility: Presence, Prominence, Portrayal, Persuasion.
- Product implication: disclose method in the PDF appendix.

AgencyAnalytics / Search Engine Journal:

- Visibility: named on buyer prompts.
- Position: how early.
- Citations: used as a source.
- Sentiment: how described.
- Keep category prompts separate from branded ones.

Similarweb agency guide:

- Conductor 2026 CMO report: 94% of enterprises plan to increase AEO/GEO spend.
- Average 12% of digital marketing budget already going to AI search visibility.
- Agencies are being told to productize the service now.

Agency service pricing:

- Dedicated citation-building retainers: $1,500–$25,000/mo.
- CiteBrief is not that service.
- CiteBrief is the measurement file those retainers need.
- $249 sits under the service line, not against it.

### Operator Signal

Reddit / agency operator language:

- They already accepted the KPI.
- They hate assembling the section.
- A screenshot + manual logging only holds up so long before it becomes a part-time job.
- Profound is expensive for multi-client books.
- Peec wins when AI data lands in existing Looker Studio / client dashboards.
- SiteSignal was called out for white-label monthly reports.
- Operators stitch multiple tools plus manual search into one more section in the report.

Product implication:

- White-label PDF + JSON/CSV export.
- Buyer prompts, not branded.
- Per-engine, not one score.
- Browser AIO + search-enabled engines.
- Multi-client economics.
- Five actions tied to lost prompts.
- Appendix with `n`, dates, engines, branded split.
- Do not invent GSC extra impressions.

### Reddit Notes

r/b2bmarketing:

- OP: “I’m constantly inundated with questions from clients about how they show up in ChatGPT, Gemini, and Claude. Especially for competitive service queries.”
- Peec → Looker Studio connector so AI data lands in the existing client dashboard.
- Another shop: “AI visibility snapshots” in quarterly reports.
- Screenshot + manual logging “only holds up so long before it becomes a part-time job.”
- Profound has reporting but is expensive for multi-client books.
- SiteSignal called out for white-label monthly reports.
- Gap: they already accepted the KPI. They hate assembling the section.

r/localseo:

- Practitioner tested 20 companies on ChatGPT / Gemini / Perplexity / AIO with customer-style questions.
- 14/20 mentioned on none of the four.
- Some #1–2 on Google, invisible in AI.
- Clients had started saying they found a competitor “on ChatGPT.”

r/webflow:

- 1,464 Webflow agencies × real buyer questions.
- Only 4.2% ever named.
- Engines disagreed.
- Perplexity’s Reddit-citation rate swung 87% → 18% in 15 days on identical questions.
- Product: sample over a week, not one run; engines disagree on purpose.

r/digital_marketing:

- Agency dashboard did not match what the client saw in ChatGPT.
- Fix adopted: 2–3 tools averaged, real UI screenshots from locations/IPs.
- Citations valued even when the brand name is not bolded.
- Product: consumer-surface / browser AIO matters.

r/AIToolTesting + r/HonestBuyerReviews:

- Agency evaluating tools because clients asked “why are we invisible in ChatGPT?”
- Profound $500–600: pretty, API data around 60% match to manual UI.
- Peec around €400 or $95 entry: prompt budget dies across 15 clients.
- Otterly $25–150: hits a wall at 2–3 brands.
- LLMRefs pitch: $79, unlimited domains.
- Repeated line: every monitor tells you where you lose, then stares at you.
- Product: 8-brand Teams plan exists because $95 × one project is the competitor trap.
- Five actions on the last page exist because “then stares at you” is the review.

r/geotoolsreview:

- Agency checklist: workspaces, client portals, white-label / branded PDFs, exports, Looker, multi-project.
- ZipTie sold as screenshots + before/after for agencies.
- RadarKit Lite is $29 / 2 projects / 15 prompts.
- Do not copy $29. Copy the report/export requirement.

### Hacker News

Weak buyer signal.

Show HNs for free GEO audits get 1–10 points.

HN is not where $249 agencies live.

Use it only as proof that free 15-prompt audits are a crowded top of funnel.

CiteBrief should not be another “paste domain, no email, 15 prompts.”

### Competitive Map

| Tool | Entry | Agency friction |
|---|---:|---|
| Otterly | $29 | Dies at 2–3 brands |
| RadarKit | $29 | Broad platform; report is a feature |
| Peec | $95 / 1 project | Extra engines + countries cost; Looker is the win |
| Profound | $99–$399+ real bills $499–600 | Pretty, pricey, API not equal to UI |
| SE Ranking / Semrush AI tracker | Inside SEO suite | Fine if they already pay the suite |
| AgencyAnalytics AI Tracker | Inside reporting suite | They already have the client PDF machine |
| Cloudflare AI visibility | Free / infra | Kills “are we cited?” vanity dashboards |
| GSC generative AI report | Free | Will be mis-added to client totals |
| Human GEO retainers | $1.5k–$25k | Need a brief to sell the work |
| CiteBrief | $99 / $249 | Only makes sense as the Friday file + 8 brands |

You do not beat Peec at daily prompts. You beat “I still rebuild this in Looker / Google Slides every month.”

### What They Want

Ranked by operator language:

| Want | Where it showed up | CiteBrief must |
|---|---|---|
| Section that drops into their report / Looker / quarterly PDF | Reddit B2B, Peec Looker, SEJ | White-label PDF + JSON/CSV export |
| Buyer prompts, not branded | SEJ, Webflow study, X, earlier spec | Default pack unbranded; branded appendix |
| Per-engine, not one score | Digiday Amazon example, IAB 4 Ps | Page 1 table by engine |
| Matches what the client sees in the actual UI | r/digital_marketing, Profound 60% complaint | Browser AIO + search-enabled ChatGPT, fail closed |
| Multi-client economics | LLMRefs vs Profound thread, Otterly 2–3 brand wall | 8 brands on Teams, $29 extra brand |
| Something after the diagnosis | Agentic SEO “stares at you,” Upshift productized audits | Five actions tied to lost prompts |
| Method they can defend | IAB 20-vendor mess | Appendix: n, dates, engines, branded split |
| Do not invent GSC extra impressions | X + GSC generative reports | Footer disclaimer |

### Freshness Score

| Claim | Freshness | Strength |
|---|---|---|
| Clients ask agencies about ChatGPT visibility | 2026 surveys + Reddit + X this week | Strong |
| 66% agencies: demand for AEO/GEO service up | AgencyAnalytics 2026 | Strong |
| Measurement is inconsistent across 20+ vendors | IAB Aug 2026 | Strong |
| White-label / export is the agency feature | Reddit + every comparison page Sep 2026 | Strong |
| Screenshots / one-run checks are distrusted | X + r/digital_marketing + Webflow volatility | Strong |
| Someone will pay $249 for CiteBrief by name | — | None. Do not claim it. |
| Daily dashboard is what they will switch from Peec for | — | Weak. They want the section, not a second UI. |

### Sources

- Digiday, 15 Sep 2026 — scramble to measure AI visibility
- Marketing Dive / IAB, Aug 2026 — 20+ vendors, 4 Ps, McKinsey 16%
- Search Engine Journal / AgencyAnalytics, Aug 2026 — 4 metrics, 66% demand, branded vs category
- Similarweb, Jun 2026 — agency playbook, Conductor budget stats
- r/b2bmarketing — client reports thread
- r/localseo — 20-company test, Aug 2026
- r/webflow — 4.2% of 1,464 agencies named
- r/digital_marketing — dashboard not equal to what client saw
- r/HonestBuyerReviews — 15-client pricing math vs Profound
- r/AIToolTesting — Profound 60% API match
- r/Agentic_SEO — monitors stare at you after the diagnosis
- HN Show HNs — free audit tools, low engagement

---

## 4. The Real Pain

### Pain 1 — The monthly call is now “are we in ChatGPT?”

Account leads are still sending ranking slides. Clients ask a different question: **does ChatGPT mention us?** If the agency answers with a vibe or a screenshot, the retainer is at risk.

Product implication:

- Page 1 of every PDF answers that question in one table.
- One number per engine: mentioned / not / who was named instead.
- Date + sample size on the page. Never a single anonymous screenshot.

### Pain 2 — A screenshot is not a metric

Decks now have an “AI visibility” slide that is one ChatGPT grab. One grab lies. Same brand can look like a contender in a screenshot and never lead across a sample.

Product implication:

- Every claim in the PDF is tied to a stored prompt + engine + timestamp.
- Show `n`, not a vibe score.
- Week-over-week delta on page 1 after the second run.
- First run has no delta; say so.

### Pain 3 — Branded prompts are rigged

“Tell me about [Client]” always cites the client. The test that matters is the question where nobody says the name: “best X for Y,” “who should I hire for Z.”

Product implication:

- Default prompt pack is unbranded buyer questions.
- Branded prompts exist as a separate sanity group.
- Branded prompts are labeled `branded` so they cannot inflate SOV.
- UI must make it hard to run a report that is 100% branded.
- Warn if branded share > 20%.

### Pain 4 — They need a file, not a login

Agencies will not send the client into Peec / Otterly / CiteBrief. They want data in their own report.

Product implication:

- Primary artifact = white-label PDF + optional `/r/[token]` read-only page.
- Client-facing surfaces have zero CiteBrief chrome.
- Export is not a paid upgrade on Teams+. It is the product.

### Pain 5 — Vanity visibility vs buyer visibility

Showing up for “what is SEO?” does not pay. Showing up for “best B2B SEO agency for SaaS” might. GSC “AI visibility” is already inside overall performance; adding it on top of a client total is misleading.

Product implication:

- Tag every prompt: `discovery | comparison | job | switch | incumbent`.
- Page 1 score weights **comparison + job + switch** higher than discovery.
- Footer on PDF: “Do not add these mentions to Search Console totals.”

### Pain 6 — One score across markets is a lie

Same buying question from London, Sydney, Chicago returns different brands.

Product implication:

- Brand has `market` country or city.
- Prompts can override locale.
- Never average markets into one SOV on a multi-market client without a per-market breakdown.

### Pain 7 — Diagnosis without next week’s work

Tools stop at “ChatGPT is not citing you.” The billable half is the list: which questions they lost, who won, what to fix by Friday.

Product implication:

- Last page of PDF = **5 actions**, each tied to a lost prompt + the competitor page/citation that won.
- No 40-page strategy essay. Five rows.

### Pain 8 — Cloudflare and GSC are giving “visibility” away

Free infra reports will eat generic “are we cited?” dashboards. They will not eat a **forwardable Friday pack with the agency’s logo**.

Product implication:

- Do not compete on “we invented AI visibility.”
- Compete on client-ready, multi-brand, dated, unbranded, actionable.

---

## 5. ICP

### Primary ICP

Title:

- Founder
- Managing partner
- Head of SEO
- Senior AM at a practice that already bills retainers

Firm:

- 5–40 people, or a serious freelancer with 4+ retainers
- SEO / content / digital PR / integrated, not a pure ads shop
- 5–25 active clients
- Retainers roughly $3k–$8k/mo
- Someone on the team already pastes ChatGPT into a deck

Trigger:

- A client asked “are we in ChatGPT?” in the last quarter
- They already sell or want to sell an “AI visibility” line item
- They tried Otterly / Peec / a free audit and still do screenshots for the client

Geography:

- US / UK / AU buyers first
- India / PH / EE shops that serve those buyers are valid

### Secondary ICP

- Freelance GEO/SEO consultant with 1–8 clients
- In-house SEO with 3–15 brands or markets
- PR / comms firm asked about citations
- Content studio that already thinks in weekly issues

### Do Not Hunt First

- Indie founder who wants a $29 toy
- Enterprise brand team that wants Profound
- Anyone whose first question is “daily SOV by prompt”

### Jobs To Be Done

| Job | Who | Success |
|---|---|---|
| Survive the monthly client call | AM | PDF forwarded without editing |
| Keep or upsell the retainer | Owner | “AI search” is a line they can bill |
| Pitch a new logo | BD | $19 / trial PDF in the proposal |
| Look senior vs the next agency | Owner | Dated sample, not a screenshot |

---

## 6. Plan Names And Packaging

Plan names should not use Agency / Studio on the SKU. Those words discard consultants and in-house.

| SKU id | Public name | Who it is for |
|---|---|---|
| `starter` | Starter | 1–2 brands, freelancer or test |
| `agency` | Teams | 8 brands, weekly Friday, 3 seats |
| `studio` | Scale | 12–15 brands, bulk send |
| `enterprise` | Enterprise | 25+ brands, contract |

Recommended caps:

| id | Public | $ | brands | prompts | cadence |
|---|---|---:|---:|---:|---|
| starter | Starter | 79 or 99 | 2 | 15–25 | monthly |
| agency | Teams | 249 | 8 | 25–30 | weekly |
| studio | Scale | 499–599 | 12–20 | 25–40 | weekly |

If you keep 5 brands at $249, the landing cannot say “your book of clients.” Either raise brands to 8 or change the sentence.

Pricing table language:

| | Starter $99 | Teams $249 | Scale $499 |
|---|---|---|---|
| Brands | 2 | 8 | 12–15 |
| Questions | 15 | 25 | 40 |
| Cadence | 1 / month | Every Friday | Every Friday |
| Engines | 3 | 4 | 4 + limited premium |
| Seats | 1 | 3 | 8 |
| Client send | — | logo + CC | bulk |

Footnote:

- Extra brand $29
- Extra brief $12
- Annual = 10 months

CTA under Teams:

> Start with one client

Marketing homepage may say “built for client teams.” Checkout must not force an identity.

---

## 7. Product Scope To Implement

This section includes P0, P1, and P2 items from the source docs as one ordered implementation scope. Nothing in this section is excluded unless it appears under “Do not add / explicitly out of scope.”

### 6.1 Prompt Quality

Prompts are the product quality.

Files:

- `src/lib/prompts.ts`
- `src/app/api/brands/[id]/prompts/generate/route.ts`
- `src/app/api/brands/[id]/prompts/route.ts`
- D1 schema for `prompts`

Add columns or JSON field:

```ts
type PromptIntent = "discovery" | "comparison" | "job" | "switch" | "incumbent" | "branded";
```

Rules:

- `branded: true` if client name appears in the question.
- Default generate pack = unbranded 15 from category + 3 competitors + market.
- If user pastes a question containing the brand name, set `intent: "branded"`.
- Branded prompts do not add to page-1 score.
- UI warning when branded share of active prompts > 20%.
- Score formula: only `comparison | job | switch` drive “Named in X of N.”
- Discovery is shown, not averaged in.
- Branded is appendix.

### 6.2 Default Prompt Pack

Generate from:

- `{category}`
- `{audience}`
- `{competitors[3]}`
- `{market}`

Do not insert the client name in the default 15.

#### Discovery (3)

1. What {category} should a {audience} in {market} look at first?
2. How do {audience} usually choose a {category}?
3. What should I know before I hire a {category}?

#### Comparison (5)

4. Best {category} for {audience} in {market}
5. {Competitor A} vs {Competitor B} vs other {category} options
6. Which {category} is worth it if budget is tight?
7. Who is a good alternative to {Competitor A}?
8. Compare the top {category} for {specific job}

#### Job / Use Case (4)

9. Who should I hire to {job} in {market}?
10. Best {category} if I need {outcome} this quarter
11. {category} for a team that already has {incumbent tool or agency type}
12. Who actually does {narrow job}, not just talks about it?

#### Switch (3)

13. I am unhappy with {Competitor A}. What are my options?
14. Reasons teams leave {Competitor A}
15. What to switch to if {Competitor A} is too expensive

#### Optional Branded Appendix

Do not score:

- What is {Client}?
- Is {Client} a good {category}?
- {Client} vs {Competitor A}

Warn in UI if the user scores these.

### 6.3 Extractor Schema

Files:

- `src/lib/extractor.ts`
- run result rows in D1

Every prompt × engine row must persist:

```ts
{
  mentioned: boolean;
  recommended: boolean;
  position: number | null;
  sentiment: "positive" | "mixed" | "negative" | "n/a";
  verbatim: string;          // <= 280
  cited_urls: string[];
  competitors_named: string[];
  status: "ok" | "unavailable";
  engine: string;
  prompt_id: string;
  ran_at: string;
}
```

Additional rules:

- Citation without a bold name still counts as citation.
- Mention and citation are separate columns on page 1.
- Cap raw engine text at 3,000 chars before extract.
- Writer sees aggregated JSON only.
- If an engine dies, that cell is `unavailable`, not a guessed yes.
- Do not ship stub answers to a customer.

### 6.4 Brand Market

Files:

- `src/app/api/brands/route.ts`
- `src/app/api/brands/[id]/route.ts`
- brand form UI

Add `market` with default `US`.

Rules:

- Pass market into prompt templates.
- Pass market into AIO/browser locale.
- Do not average two markets into one SOV.

### 6.5 Report / PDF

The PDF is the client section.

Files:

- report writer
- PDF template
- search `report-writer`, `pdf`, `SAMPLE_REPORT`

Lock 6–8 pages:

1. Cover + scoreboard: per engine mention %, citation %, who won, delta vs last run, `n`, market, date
2. Lost buyer questions, unbranded only
3. Short verbatim + cited URL
4. Competitors who took the slot
5. Five actions
6. Method appendix: prompt list with intent tags, engines, timestamps, line: “Do not add these mentions to Search Console totals.”

Optional subtitle on page 1:

- Presence
- Prominence
- Portrayal

No “GEO/AEO/LLM” in the default PDF.

Filename:

```txt
{Agency}_{Client}_AI-brief_{YYYY-MM-DD}.pdf
```

Client PDF:

- No CiteBrief mark.
- Agency logo, color, from-name.
- White-label filename.
- `/r/[token]` read-only, no signup.

### 6.6 Page 1 Requirements

Page 1 must include:

- Client logo
- Date
- Market
- `n` prompts × engines
- Table: engine × mentioned % × top substitute brand
- Delta vs last run, or “first brief — no trend yet”
- Sentence: “Unbranded buyer questions only. Branded checks in appendix.”
- Mention and citation as separate signals.
- One number per engine: mentioned / not / who was named instead.

### 6.7 Lost Questions Page

Rows:

- Prompt
- Engines that omitted the client
- Who they named
- Citation URL if any

### 6.8 Five Actions

Last page:

- Five actions
- Each action maps to one lost prompt
- No 40-page strategy essay

### 6.9 Export

Teams+:

- JSON export of extractor rows
- CSV export of extractor rows

Endpoint:

- `/api/brands/[id]/runs/[runId]/export`

UI:

- brand history
- brief list
- analyst workflow

Export is the product, not an upgrade-only afterthought.

### 6.10 Run Model And Margin

Cadence:

- Starter monthly
- Teams / Scale weekly Friday in client timezone

Included rows:

- Cheap models only.
- No Claude / Sonnet on included rows.
- No infinite daily.
- Credits, not infinite daily.
- Log dollars and tokens per engine per run.
- Kill a cell if cost > $0.03.

Model rules:

- Cap raw engine text at 3,000 characters before extract.
- Writer model sees aggregated JSON only.
- One writer call per run.

Engines:

- Current cheap engines with search.
- No chatbot dump.
- Keep Perplexity off Gateway if Cloudflare cannot bill it.
- Do not add raw `PERPLEXITY_API_KEY`.
- Say 3 live + AIO if Cloudflare cannot support Perplexity through Gateway.

### 6.11 Client Send And AM Workflow

Teams+:

- Client CC
- Slack/email “Friday pack” to the workspace
- Members: owner + AMs
- Client never gets a seat
- History of past PDFs per brand

Briefs list:

- Workspace-wide status: Running / Ready / Sent / Failed
- Primary action on Ready: Send
- Secondary: Download, Copy link, Export CSV

### 6.12 Pitch Run And Extra Usage

Implement:

- Pitch run $19, no seat
- Extra brand $29
- Extra PDF / brief $12
- Optional daily pulse as +$99 / brand, 20 priority prompts, 2 engines

Daily pulse is not default.

### 6.13 Command Center

Command Center:

- All clients
- Whose PDF is late
- Who dropped
- Ready to send
- This week’s actions
- Risk filters
- Client actions

The first block is send queue, not a 9-column spreadsheet.

---

## 8. Landing Page

Job of the page:

> Get an AM to send one client domain. Not explain GEO.

Primary CTA:

> Send a client domain

Secondary CTA:

> See a sample Friday brief

Sample PDF must be downloadable without signup.

### Cut

- “All-in-one AI visibility platform”
- Agency / Studio as plan titles
- Feature grids of engines as the hero
- Fake 10,000% charts
- “Trusted by” logos you do not have
- Signup-first wall before they understand the file

### Keep / Add

- One sentence job
- A real page-1 table, static image of an anonymized brief
- Proof from the category
- Price in the open
- “First brief on us” or 14-day 1-brand trial

### Nav

```txt
CiteBrief · Sample · Pricing · Sign in
Right: Send a domain
```

### Hero

Eyebrow:

> Friday brief for client teams

H1:

> The file your AM can forward when the client asks “are we in ChatGPT?”

Sub:

> Unbranded buyer questions across ChatGPT, Perplexity, Gemini, and Google AI Overviews. One white-label PDF per client, every Friday.

CTA primary:

> Send a client domain

CTA ghost:

> Read a sample brief

Trust line:

> No client login. Your logo. Dated sample — not one screenshot.

Hero visual:

- Right column: first page of the PDF.
- Use table + logo + date.
- Not a SaaS dashboard.

### Proof Strip

Use category proof, not fake logos:

> 66% of agencies say clients now ask for this. 48% still cannot measure it.

Source: AgencyAnalytics 2026.

### Problem Strip

Three columns:

1. The slide is a screenshot
2. The prompt had the brand in it
3. The client still doesn’t have a number

### How A Brief Works

1. You add a client, 3 competitors, a market
2. We run the unbranded pack on the engines
3. Friday you get a PDF the AM forwards

### What’s On Page 1

Use a cropped real table:

- Mentioned or not, per engine
- Who got the slot
- Which buyer questions you lost
- Five actions for next week

### Who It’s For

- Practices with retainers
- Consultants with more than one logo
- In-house teams with more than one brand

Do not say “only agencies.”

### Not This

- Not a daily dashboard (Peec / Otterly)
- Not an enterprise suite (Profound)
- Not Search Console with a new name

### FAQ

- Do clients need an account? No.
- Can I use branded questions? Yes, in an appendix. They do not drive the score.
- Is this GSC AI visibility? No. Do not add our mentions to GSC totals.
- Which models? Current cheap engines with search. Not a chatbot dump.

### Footer CTA

> Send one domain. Friday you have a brief.

### Copy Rules

- Talk to the AM, not “marketers in the age of AI.”
- Show a table, not an abstract orb.
- Price on the first screen of `/pricing`, not “contact us” for $249.
- Sample PDF must be downloadable without signup.

### On-Page Hero Form

Fields:

- Work email
- Client domain
- 1–3 competitor domains
- Market, US default

Submit:

- Create the workspace + brand draft.
- Start the first run or queue it.

Success state:

> You’ll have a brief. We email this address.

Do not dump them into an empty dashboard with no brand.

---

## 9. Activation

First session:

1. Email + domain form on the landing page
2. Auto-suggest 15 prompts from category
3. User can edit 5 minutes, not 50
4. Run 3 engines × 15 prompts once
5. PDF ready email + in-app “Download brief”
6. Paywall after download or on second brand — pick one and stick to it

Recommended:

- First brief free with trial caps
- Second Friday requires Starter / Teams

Success metric:

> PDF downloaded, not account created.

---

## 10. App UI / UX

### Verdict On Current App

Ship the information architecture. Redesign the chrome.

What exists:

- Home is a real command center.
- Good bones: KPIs, actions, 9-column table.
- Too many sibling routes.
- Home title is a 20px “Overview” over a raw table.
- Feels like an internal tool, not a $249 product.
- Marketing is serif + editorial.
- Product is flat cards + muted text + 12px table.
- The two worlds do not meet.
- Starter LightHome still says “Upgrade to Agency.”
- Empty states are fine.
- Density is fine.
- Beauty is missing: no sidebar rhythm, no page header pattern, no command palette, no visual of the PDF.

An AM opening this on Monday should feel Linear / Attio / Mercury — not a CRUD list.

### Do Not Rebuild With A Template

Keep:

- Next.js App Router
- existing `src/components/ui`
- shadcn

Do not replace the app with a cloned admin boilerplate.

Use:

1. shadcn official dashboard-01 / sidebar-07
2. Kiranism next-shadcn-dashboard-starter for feature folders, data-table toolbar, theme toggle
3. satnaing shadcn-admin for collapsible sidebar, search in top bar, clean tables

Do not fork the full template.

### Target Sidebar

```txt
CiteBrief
  [Workspace ▾]

  Home
  Clients
  Briefs

  ─────────
  Settings
```

Rename:

- Brands → Clients
- Reports → Briefs

Everything else becomes a tab or panel:

| Old route | New home |
|---|---|
| `/app/prompts` | Client → Questions tab |
| `/app/competitors` | Client → Competitors tab |
| `/app/insights` | Client → after a brief exists; or Home “Insights” panel |
| `/app/opportunities` | Home “This week” + Client Actions |
| `/app/risks` | Home filter `?view=risk` |
| `/app/activity` | Home footer / Settings → Activity |
| `/app/reports` | Briefs list |

Keep old URLs as redirects for a month.

Primary jobs in the chrome:

1. What do I send Friday? → Home + Briefs
2. How is this client? → Clients / [id]
3. Can I add another logo? → header “Add client”

### App Shell

Structure:

```txt
┌────────240────────┬──────────────────────────── content ──────────────────────────┐
│ logo  CiteBrief   │  Home / Acme  ›  Brief          [⌘K]     [Add client]  [AV]   │
│ workspace ▾       ├───────────────────────────────────────────────────────────────┤
│                   │                                                               │
│  Home             │  page header + one primary action                             │
│  Clients    8     │                                                               │
│  Briefs     3 ●   │  body                                                         │
│                   │                                                               │
│  ───────────      │                                                               │
│  Settings         │                                                               │
│                   │                                                               │
│  Teams · 6/8      │                                                               │
└───────────────────┴───────────────────────────────────────────────────────────────┘
```

Rules:

- Sidebar 240px.
- Collapse to icons at `lg` if they want canvas.
- Top bar 56px, border-b only.
- Command-K searches clients + briefs.
- Badge on Briefs = ready to send count.
- Plan chip at sidebar footer: `Teams · 6/8 clients` → billing.
- Mobile: sidebar becomes a Sheet.
- Bottom nav is not needed if Add client + Home are in header.

### Home

Wireframe:

```txt
┌ page header ────────────────────────────────────────── [Add client] [Export] ┐
│ This week                                              Friday · 2 days        │
│ 3 briefs ready · ClickUp leading 4 clients                                    │
└───────────────────────────────────────────────────────────────────────────────┘

┌ KPI ┐ ┌ KPI ┐ ┌ KPI ┐ ┌ KPI ┐
│ 11/25│ │  2  │ │  6  │ │ 14h │
│ named│ │risk │ │acts │ │saved│
│ ↑ +2 │ │watch│ │due  │ │est. │
└──────┘ └─────┘ └─────┘ └─────┘

┌ Ready to send ────────────────────────────────────────────── [Send selected] ┐
│ ☑ Northstar  · brief 12 Sep · AM: Priya                        [Preview] [Send]
│ ☑ Helix      · brief 12 Sep · AM: You                          [Preview] [Send]
└──────────────────────────────────────────────────────────────────────────────┘

┌ Clients                                              filters: All · Risk · Δ  ┐
│ Client      Named   Engines              Who won     Δ     Next               │
│ Northstar   11/25   ●●●○                 ClickUp     +2    Send brief         │
│ Helix        4/25   ●●○○                 Semrush     -3    Fix questions      │
└───────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- First block is send queue, not a 9-column spreadsheet.
- KPI cards are 1 number + 1 delta.
- Engine dots beat a paragraph.
- Click row → client.
- Click Send → confirm sheet with recipients + logo check.
- Starter / trial Home is the same layout with one client and a big “Run first brief” card.
- Never a different product.

### Client Page

Wireframe:

```txt
┌ Northstar · US · category: project tools          [Run brief] [Download PDF] ┐
│ Questions 25 · 3 branded (excluded from score)                                │
│ tabs: Overview · Questions · Briefs · Competitors · Settings                  │
└───────────────────────────────────────────────────────────────────────────────┘

Overview
  ┌ ChatGPT 11/25 ┐ ┌ Gemini 8/25 ┐ ┌ Grok 6/25 ┐ ┌ AIO 4/25 ┐
  Lost this week (unbranded)
    best PM tool for agencies → ClickUp · 3 engines
    …
  Five actions
    1. Comparison page vs ClickUp
```

Questions tab:

- intent badges: `comparison`, `job`, `branded`
- toggle archive
- warning if branded > 20%

### Briefs List

Workspace-wide:

- Running
- Ready
- Sent
- Failed

Primary action on Ready:

- Send

Secondary actions:

- Download
- Copy link
- Export CSV

### Onboarding

One column, four steps, no dashboard chrome except a slim top bar:

1. Client domain, name, market, 3 competitors
2. Review 15 unbranded questions
3. Running… per-engine progress
4. Brief ready → Download · “Would you forward page 1?”

If they bounce at step 2, save the client and put “Finish first brief” on Home.

### Visual System

Direction:

> Editorial marketing + product = Linear-quiet.

Rich means paper, type, tables, one accent — not glassmorphism or purple meshes.

Tokens:

| Role | Suggested |
|---|---|
| bg | `#FAFAF8` warm paper |
| surface | `#FFFFFF` |
| sidebar | `#111110` near-black or `#F3F2EE` if light |
| fg | `#1A1917` |
| muted | `#6F6B64` |
| line | `#E8E6E1` |
| accent | ink `#1A1917` buttons + signal `#C45C26` for ready to send |
| named / good | `#1F7A4D` |
| missing / risk | `#B42318` |
| pending | `#B45309` |

Type:

- Marketing H1: keep serif.
- App: sans only.
- Page titles: `text-2xl font-semibold tracking-tight`, 28–32px.
- Numbers: `tabular-nums`.
- Scores are the jewelry.

Radius:

- 10–12 on cards
- 8 on controls

Shadow:

- `0 1px 2px rgb(0 0 0 / 0.04)` only.
- No 24px glow.

### Components To Standardize

- `PageHeader`
- `KpiCard`
- `StatusBadge`
- `EngineRow`
- `ClientRow`
- `EmptyState`
- `SendSheet`

### Motion

- 150–200ms opacity/translate on sheets.
- No page fade on every navigation.
- Reduced-motion: instant.

### Accessibility

- Sidebar `nav` with `aria-current`.
- Focus ring 2px accent.
- Tables: one `<table>`, not div soup.
- Contrast muted text >= 4.5 on paper.

### Navigation Rules

1. One primary action per page.
2. Home = Add client or Send briefs if any Ready.
3. Client = Run / Download.
4. Never two equal filled buttons.
5. Command-K: jump to client, last brief, billing.
6. Brand switcher in sidebar, not a second nav.
7. Breadcrumb: `Clients / Northstar / 12 Sep brief`.
8. After a run completes, toast + deep link: “Northstar brief ready — Preview / Send.”
9. Starter users see the same IA. Locked items show a quiet upgrade line in context.

### What Rich SaaS Is Not

- Gradient orbs
- Bento overload
- 3D PDF mock
- A second analytics product
- Dark mode on day one
- Cloning Kiranism’s kanban / Clerk pages

Rich here = the Friday queue looks expensive, type is confident, empty states are calm, and an AM can send without hunting.

---

## 11. Implementation Order

This order combines the source docs’ suggested commit order, UI implementation order, and research-to-product checklist.

### Step 1 — Schema

Add:

- prompt `intent`
- prompt `branded`
- brand `market`
- extractor columns:
  - `position`
  - `sentiment`
  - `verbatim`
  - `cited_urls`
  - `competitors_named`
  - `status`
  - `ran_at`

### Step 2 — Prompt Generate Templates

Implement:

- default unbranded pack
- branded appendix
- intent tagging
- branded warning > 20%
- archive vs active
- market / locale on brand

### Step 3 — Extractor + Writer + PDF

Implement:

- strict JSON extractor schema
- mention vs citation separation
- unavailable status
- 3,000 char raw text cap
- writer on aggregated JSON only
- 6–8 page PDF
- page 1 scoreboard
- lost questions
- per-engine excerpts
- competitors who took the slot
- five actions
- method appendix
- GSC disclaimer
- white-label filename
- no CiteBrief mark on client copy

### Step 4 — Landing Form + Copy

Implement:

- hero form: work email, client domain, competitor domains, market
- proof strip
- sample brief download without signup
- success state: “You’ll have a brief. We email this address.”
- account or brand draft creation
- first run queue

### Step 5 — Plan Labels + Caps

Implement:

- Starter / Teams / Scale
- `agency.name = "Teams"`
- `studio.name = "Scale"`
- Teams = 8 brands if using “book of clients” story
- update pricing page
- update footer CTA
- remove “Agency is $249 for 5 brands” copy

### Step 6 — CSV / JSON Export

Implement:

- extractor row export
- run export endpoint
- brand history UI export
- brief export action

### Step 7 — App Shell

Implement:

- shadcn Sidebar + PageHeader
- nav cut to Home / Clients / Briefs / Settings
- old URLs redirect for a month
- plan chip in sidebar
- ready-to-send badge on Briefs

### Step 8 — Home

Implement:

- send queue first
- KPI row
- engine dots
- client table
- same layout for Starter / trial

### Step 9 — Client Page

Implement:

- tabs: Overview / Questions / Briefs / Competitors / Settings
- per-engine cards
- lost prompts
- five actions
- branded prompt warning

### Step 10 — Briefs List

Implement:

- Running / Ready / Sent / Failed
- Send action
- Download
- Copy link
- Export CSV

### Step 11 — Command-K + Toasts

Implement:

- Command-K search for clients, briefs, billing
- toast after run completes
- deep links Preview / Send

### Step 12 — Onboarding

Implement:

- full-width stepper
- no sidebar noise
- four steps
- save bounced step 2 users
- “Finish first brief” on Home

### Step 13 — Additional Commercial Workflow

Implement:

- “Would you forward page 1?” after first PDF
- store `forwardable: boolean` on run
- branded appendix toggle on PDF
- 5-minute prompt edit cap, then run
- per-run cost surfaced to owner/admin only
- pitch run $19
- extra PDF / brief $12
- optional daily pulse +$99 / brand

---

## 12. QA Before Sending The Next Real PDF

1. Run one unbranded pack on a real client vs 3 competitors.
2. Confirm no stub answers.
3. `status: unavailable` if an engine dies.
4. Page 1 table matches what you see in ChatGPT UI for 3 prompts.
5. Branded “What is {Client}?” does not raise the headline score.
6. AM who is not you answers: “Would I forward this Friday?”
7. If no, fix the PDF, not the dashboard.

---

## 13. Do Not Add / Do Not Confuse With Demand

Do not add:

- Daily SOV for every prompt on Teams
- Claude / Sonnet on included rows
- In-app “we’ll write the GEO content”
- Public leaderboard
- GSC as a hero integration
- Another 15-prompt no-email public toy
- Client seats / client dashboard login
- Raw `PERPLEXITY_API_KEY`
- Daily dashboard as the main product
- Enterprise suite positioning
- Search Console with a new name

Do not confuse with demand:

- Nobody on X asked for getcitebrief.com.
- They asked for a dated, unbranded, forwardable answer.
- If the product and landing say anything else first, you are building a dashboard in a market that already has free ones.

---

## 14. Checklist

- [ ] Rename public plan labels to Starter / Teams / Scale
- [ ] Teams = 8 brands if using “book of clients” language
- [ ] Default prompt pack unbranded
- [ ] Branded prompts = appendix
- [ ] Prompt intent stored
- [ ] Branded share warning > 20%
- [ ] Brand market field
- [ ] AIO/browser locale uses market
- [ ] Extractor schema as specified
- [ ] Mention and citation separate
- [ ] Engine death = unavailable
- [ ] Raw text cap 3,000 chars
- [ ] Writer receives aggregated JSON only
- [ ] PDF 6–8 pages
- [ ] Page 1 = scoreboard
- [ ] Last page = five actions
- [ ] GSC disclaimer in PDF footer
- [ ] White-label filename
- [ ] No product mark on client copy
- [ ] CSV export
- [ ] JSON export
- [ ] Landing hero + domain form
- [ ] Sample PDF without signup
- [ ] Proof strip with 66% / 48%
- [ ] Pricing table matches new names
- [ ] Onboarding first-session flow
- [ ] “Would you forward page 1?” capture
- [ ] Per-run owner/admin cost
- [ ] App shell redesigned
- [ ] Home send queue first
- [ ] Clients / Briefs naming
- [ ] Command-K
- [ ] Toast when brief is ready
- [ ] Redirect old routes for one month

---

## 15. Source Coverage Cross-Check

Included from `APP-UPDATES.md`:

- Already shipped list
- Drift table
- P0 changes
- Prompt intent / branded
- Extractor schema
- PDF requirements
- Brand market
- Landing first session
- Plan labels
- P1 items
- P2 items
- Do not add
- QA
- Suggested commit order

Included from `UI-UX-DASHBOARD.md`:

- Current app verdict
- Template guidance
- Sidebar IA
- Wireframes
- Visual tokens
- Components
- Motion
- Accessibility
- Navigation rules
- UI implementation order
- “Rich SaaS is not”

Included from `PAIN-ICP-PRODUCT-LANDING.md`:

- Real pain
- ICP
- Jobs to be done
- Plan names
- Product implementation scope
- Landing page sections
- Default prompt pack
- Activation
- Implementation checklist
- Demand caveat

Included from `RESEARCH-DEMAND-2026-09.md`:

- Verdict
- AgencyAnalytics stats
- IAB / Marketing Dive 4P measurement framing
- Reddit operator signal
- HN caveat
- Consolidated wants
- Competitive map
- Freshness score themes
- Research-to-product additions
