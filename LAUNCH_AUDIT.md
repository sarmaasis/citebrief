# CiteBrief Launch Audit

Date: 14 Sep 2026  
Status: serious pilot-ready, not yet fully premium public-launch ready

## Executive Summary

CiteBrief is close to a strong founder-led pilot. The core product direction is sharp: a white-label Friday AI-search report that agencies can send to clients.

The product should not be marketed as another GEO dashboard or prompt tracker. The winning position is:

> The Friday AI-search report agencies send to clients.

Current local checks are healthy:

- `npm test` passes.
- `npm run lint` passes.
- Working tree was clean at the latest check.
- No obvious committed live secrets were found in a local scan.

The main remaining launch work is trust, production verification, legal/compliance, security hardening, and a highly polished sample report.

## Current Technical Status

### Good

- Single-domain auth is the right product/security direction.
- Client report links are tokenized and noindexed.
- App and API routes are private or disallowed from indexing.
- Dodo webhook handling uses the official Hono middleware for live verification.
- Live engine failures no longer silently return deterministic stub data.
- Extra-run billing now waits until a complete or partial report exists.
- Run creation now inserts the run before enqueueing, avoiding a queue race.

### Needs Attention

- `npm audit --audit-level=moderate` reports a moderate `esbuild` advisory through `drizzle-kit` dev tooling.
- Production build still needs to be verified before deployment.
- Live Cloudflare AI Gateway calls need an end-to-end check.
- Live Dodo checkout, portal, cancellation, and webhook paths need a real test.
- Migrations through `0009_run_billing.sql` must be applied in production.

## Security Audit

### Already In Good Shape

- Auth is anchored to `getcitebrief.com`.
- Optional domains should redirect only and not share auth sessions.
- Internal auth secrets exist for cron, admin, and run processing.
- Client links are token URLs and do not require login.
- Report pages use `noindex`.
- Live AI failures are treated as failures rather than successful stubbed answers.

### Security Work Before Public Launch

Add global security headers:

- `Content-Security-Policy`
- `X-Frame-Options` or CSP `frame-ancestors`
- `Referrer-Policy`
- `Permissions-Policy`
- `X-Content-Type-Options`
- `Strict-Transport-Security`

Add rate limits for:

- Sign in and sign up
- Magic links
- Run creation
- Report sending
- Invite creation
- Public report token access
- Internal/admin endpoints

Add admin audit logs for:

- Impersonation
- Webhook replay
- Report sends
- Billing actions
- Invite creation and revocation
- Workspace settings changes
- Brand deletion/archive actions

Production hardening:

- Production must never accept `dev-admin`.
- Production must never run with `stub` internal secrets.
- Report token links should be revocable from the UI.
- Cloudflare Email Service: onboard `getcitebrief.com`, verify SPF/DKIM/DMARC, then confirm Friday and invite sends.
- Dodo live webhook verification must be tested with actual live/test-mode webhook payloads.

## SEO Audit

### Current Strengths

- Canonical origin is `https://getcitebrief.com`.
- Sitemap exists.
- Robots configuration exists.
- Private routes are disallowed/noindexed.
- Client report links are noindexed.
- Public pages have metadata.
- JSON-LD exists for key public pages.
- Pricing FAQ schema is covered by tests.

### SEO Gaps

Current public pages are not enough for category capture. Add commercial landing pages:

- `/for-seo-agencies`
- `/for-pr-agencies`
- `/white-label-ai-visibility-reports`
- `/ai-visibility-report-template`
- `/geo-reporting-for-agencies`
- `/ai-search-reporting-for-agencies`

Add comparison pages:

- `/alternatives/otterly`
- `/alternatives/profound`
- `/compare/peec`
- `/compare/ai-rank-lab`
- `/compare/aeo-vision`

Add agency playbooks:

- How to sell AI visibility reporting as a retainer add-on
- How to explain AI-search visibility to a client
- The 20 AI-search prompts every B2B SaaS client should track
- How to build a GEO reporting package for agencies
- What to send clients every Friday about ChatGPT visibility

## Compliance Audit

Current privacy and terms pages are a good start, but they are not yet legal-grade.

Add:

- Data Processing Addendum
- Subprocessors page
- Data retention policy
- Account/data deletion request process
- Data export process
- AI report disclaimer
- Cookie policy if analytics are added
- GDPR/CCPA language if selling internationally or broadly in the US
- Security page

The security page should explain:

- Auth model
- Data storage
- Payment processor
- Email processor
- AI providers / Cloudflare AI Gateway
- Report retention
- Client link expiration
- Incident contact

## Market Readiness

The market is ready but crowded. AI visibility and GEO are active agency categories in 2026. Agencies are already being sold:

- White-label AI visibility reports
- Multi-client AI-search dashboards
- GEO audits
- AI citation tracking
- AI visibility optimization services

That is good because demand exists. It is dangerous because generic tracking is commoditized.

CiteBrief should not compete as the deepest tracker. It should compete as the report layer agencies can immediately monetize.

## Positioning

Primary positioning:

> The Friday AI-search report agencies send to clients.

Supporting message:

> Add AI-search reporting to every client retainer without writing another deck.

Homepage headline options:

- The Friday PDF your client actually reads.
- Add AI-search reporting to every client retainer.
- Show clients who AI recommends: them or their competitors.

Avoid:

- Generic GEO platform
- AI visibility dashboard
- Keyword tracker
- Content generator
- Peec/Profound replacement

## Launch Strategy

### Founder-Led Pilot

Offer:

> Send me one client URL and three competitors. I will generate your first AI-search report free.

Ask for:

- Client brand
- Client URL
- Three competitors
- Category
- Buyer type
- Incumbent/default competitor

Success metric:

- They forward the report to the client.
- They ask to white-label it.
- They ask how much it costs.

### Pilot Targets

Start with:

- B2B SaaS SEO agencies
- Content agencies
- PR agencies
- Performance/search agencies adding AI-search strategy

Qualification:

- 5+ active clients
- Already sells SEO, content, PR, or paid search retainers
- Has clients asking about ChatGPT, Gemini, Perplexity, or AI Overviews

### Pilot Goals

Before broad launch:

- Generate 10 real agency reports.
- Get 5 agencies to forward a report to a client.
- Get 3 agencies to react to the $249 Agency price.
- Get 1 agency to pay or verbally commit.

## Product Scope

### Needed For Launch

Keep the launch product focused:

- Brand setup
- Prompt generation
- Four core answer surfaces
- Polished PDF
- Client link
- White-label branding
- Billing
- Usage limits
- History
- Report send
- Client CC on Agency+
- Team members on Agency+
- Slack webhook on Agency+

### Do Not Add Yet

Avoid adding these before customer proof:

- Full content optimizer
- CMS
- Giant analytics dashboard
- CRM integration
- GA4 attribution
- AI crawler log analysis
- Automated content creation
- Too many engines

These may become useful later, but they dilute the core wedge now.

### Later Expansion

After real customers:

- GA4 / CRM attribution
- Competitor trend reports
- Industry prompt packs
- Agency-branded client portal
- Quarterly strategy deck export
- AI crawler/source monitoring
- More engine coverage if customers demand it

## Highest-Level Launch Bar

CiteBrief should be considered premium-launch ready only when:

- `npm test`, `npm run lint`, and `npm run build` pass.
- Live AI Gateway calls are verified.
- Live Dodo checkout and webhooks are verified.
- Cloudflare Email deliverability is verified (auth, invite, Friday send).
- Friday cron works across multiple tenant timezones.
- Client links expire and can be revoked.
- Security headers are live.
- Legal/compliance pages are upgraded.
- A sample report is strong enough to be the homepage hero.
- At least one agency is willing to pay.

## Verdict

CiteBrief is close to serious pilot readiness.

It is not yet fully premium public-launch ready until live infrastructure, security hardening, compliance pages, and agency proof are complete.

The next highest-leverage work is:

1. Produce one excellent sample report.
2. Verify live AI Gateway.
3. Verify live Dodo.
4. Add security headers and rate limits.
5. Run 10 founder-led agency pilots.
