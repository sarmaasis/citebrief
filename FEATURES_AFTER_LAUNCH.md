# CiteBrief Post-Launch Feature Roadmap

## Positioning

CiteBrief should not be boxed into agencies only. The product should serve three buyer types:

| Buyer | Main job |
|---|---|
| Founders and small teams | Know whether AI search can find and recommend the brand |
| Marketing / GEO teams | Track visibility, competitors, cited sources, and weekly actions |
| Agencies and consultants | Package AI-search visibility into client-ready reports and retainers |

The product should compete on actionable reporting, not raw prompt volume alone. Otterly-style breadth matters, but CiteBrief's wedge is: "show what changed, what to fix, and package it into a report people can use."

## Updated Packaging

| Plan | Price | Capacity | Best for |
|---|---:|---:|---|
| Starter | $79/mo | 2 brands, 25 questions per brand, 50 tracked questions | Founders, small teams, freelancers |
| Growth | $249/mo | 5 brands, 30 questions per brand, 150 tracked questions | Marketing teams, SaaS, ecommerce, GEO teams |
| Agency | $599/mo | 20 brands, 25 questions per brand, 500 tracked questions | Agencies, consultants, multi-client teams |
| Enterprise | $1,499+/mo | Custom | High-volume, SSO, onboarding, custom limits |

## Build First

### 1. Cited Pages And Source URL Analysis

**Why:** This is the biggest missing value compared with serious AI-search platforms. Users need to know which pages are being cited, not only whether the brand was mentioned.

**User value:**
- See own cited URLs by engine.
- See competitor URLs winning recommendations.
- Find pages that need proof, pricing, freshness, comparisons, or schema.
- Export cited source lists.

**Plan:** Growth+

### 2. Visibility Trend Charts

**Why:** Weekly reports need visible movement. Users should immediately know whether things are improving or declining.

**User value:**
- Mention rate over time.
- Recommendation rate over time.
- Competitor share over time.
- Average rank / shortlist position.
- Citation share.

**Plan:** Starter gets basic trend, Growth+ gets full dashboard.

### 3. Prompt Research Tool

**Why:** Users need more than the first generated prompt set. This makes the product feel like a serious AI-search workflow, not just a report generator.

**User value:**
- Generate discovery, comparison, job-to-be-done, switching, and incumbent prompts.
- Expand prompts by buyer, market, country, and product line.
- Deduplicate and score prompts before saving.

**Plan:** Starter limited, Growth+ full.

### 4. Action Queue

**Why:** Reports should turn into work. This is the feature that makes CiteBrief more useful than a monitoring table.

**User value:**
- Prioritized fixes.
- Suggested page updates.
- Comparison page ideas.
- Proof/case-study gaps.
- Content refresh recommendations.
- Status: open, planned, done, dismissed.

**Plan:** Growth+

### 5. Alerts

**Why:** Users do not want to manually inspect every report.

**User value:**
- Brand disappeared from recommendations.
- Competitor overtook brand.
- New competitor appeared.
- Important source URL changed.
- Visibility score dropped.

**Plan:** Growth+

## Build For Agency Expansion

### 6. Prospect Pitch Audits

**Why:** This can help agencies sell CiteBrief-powered services before a prospect becomes a client.

**User value:**
- Run a limited audit for a prospect.
- Generate a pitch-ready summary.
- Convert prospect into a tracked client brand.

**Plan:** Agency+

### 7. Client Portal Archive

**Why:** Agencies need a professional place for clients to see past reports without logging into the internal workspace.

**User value:**
- Branded client report archive.
- Current and past PDFs.
- Share/revoke links.
- Optional client viewer access later.

**Plan:** Agency+

### 8. White-Label Report Builder

**Why:** The current brand kit is useful, but agencies will expect deeper control at higher prices.

**User value:**
- Logo, colors, prepared-by footer.
- Default intro/outro.
- Report section toggles.
- Custom CTA.

**Plan:** Agency+

## Build Later

### 9. Multi-Country Tracking

**Why:** Competitors advertise broad country support. CiteBrief should add it when customers ask for location-specific reports.

**Plan:** Growth+

### 10. API And Looker Studio Export

**Why:** Useful for advanced teams, but not required before the reporting and action workflow is loved.

**Plan:** Agency+ / Enterprise

### 11. MCP Access

**Why:** Good for technical users and partner workflows, but not a launch blocker.

**Plan:** Enterprise or paid add-on

### 12. Agent Analytics

**Why:** Interesting category expansion, but separate from the core buyer promise.

**Plan:** Enterprise later

## What Not To Build Yet

- Do not copy every competitor feature before launch.
- Do not add daily tracking to low plans until runtime and costs are proven.
- Do not add Claude by default until COGS are controlled.
- Do not offer unlimited prompts or unlimited reports.
- Do not build MCP/API before cited pages, trends, and action queue are strong.

## Launch Readiness Rule

Build the next feature only when one of these is true:

1. Three paying customers ask for it.
2. It directly improves activation or trial-to-paid conversion.
3. It helps justify Growth at $249 or Agency at $599.
4. It reduces support or manual founder work.

