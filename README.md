# CiteBrief

AI-search visibility reports for agencies. Every Friday: a white-label PDF that shows whether the client was named in ChatGPT, Gemini, Grok, and Google AI Overviews.

**Canonical domain:** [getcitebrief.com](https://getcitebrief.com). Optional redirect: `citebrief.xyz`.

Stack: Next.js App Router on Cloudflare Workers via `@opennextjs/cloudflare` (not Pages) · Better Auth · Dodo Payments (`@dodopayments/hono`) · D1 / KV / R2 / Queues

See [PRODUCT.md](./PRODUCT.md) and [DESIGN.md](./DESIGN.md). Design tokens use the `--cb-*` prefix.

## Phases

**Phase 1:** OpenNext Worker, Better Auth, D1 schema, marketing + app shells.

**Phase 2:** Brands CRUD, 20-prompt editor with 4+4+4+4+4 mix and vanity rejection, onboarding (6 fields to generated 20), run enqueue + poll UI, brand home.

**Phase 3:** Engine fan-out (stub + live adapters), run_rows, soft-fail ≥4/5, HTML+PDF to R2, in-app report viewer.

**Phase 4:** Dodo checkout/webhooks (official Hono where live keys exist), billing UI, brand kit, client link `/r/[token]`, run/brand caps, report email send.

**Phase 5:** History/MoM sparkline, members invite stub, workspace settings, Friday cron (tenant timezone), marketing `/report` + legal pages, StatusPill token polish.

**Later follow-ups:** Live engine APIs through Cloudflare AI Gateway, Queue consumer Worker for `citebrief-runs`, `@dodopayments/hono` Checkout/Webhooks mounts, Friday 06:00 per workspace timezone, CC-client Dialog.

**PRD §18 remaining gaps:** Members invite accept, Slack incoming webhook (Agency+), 24h engine cache, billing depth (extra brand/run, trial caps, dunning, cancel-at-period-end, Dodo portal), internal admin (impersonate, COGS, webhook replay).

### App routes (summary)

| Route | What |
|---|---|
| `/app` | Home with this-week brands or empty state |
| `/app/brands` | Brand list, archive / restore |
| `/app/brands/[id]` | Brand home |
| `/app/brands/[id]/prompts` | 20-set editor |
| `/app/brands/[id]/runs/[runId]` | Queue + engine poll |
| `/app/brands/[id]/reports/[reportId]` | Report viewer (Download / Copy link / CC client) |
| `/app/onboarding` | 3-step first brand |
| `/api/internal/process-run` | Local/dev run processor (Bearer `INTERNAL_PROCESS_SECRET`) |
| `/api/cron/friday` | Manual/dev Friday enqueue (Bearer `CRON_SECRET`) |

Prompt generation fills the PRODUCT.md templates when AI Gateway is not configured. Configure `CF_ACCOUNT_ID`, `AI_GATEWAY_ID`, and a scoped Cloudflare token to use live gateway-routed models.

## Local setup

Requires Node 20+.

```bash
npm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set at least `BETTER_AUTH_SECRET` (32+ random characters). Outside development, also set `INTERNAL_PROCESS_SECRET` and `CRON_SECRET` (Bearer auth for `/api/internal/process-run` and `/api/cron/friday`). Stub values are fine for Google, Dodo, and engines until Cloudflare AI Gateway is configured. Local email stubs when the `EMAIL` binding is unbound.

### Next.js dev (Node)

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). `initOpenNextCloudflareForDev()` in `next.config.ts` loads Wrangler bindings so `getCloudflareContext()` works in `next dev`.

Apply the D1 schema to the local database:

```bash
npx wrangler d1 create citebrief
# put the returned database_id into wrangler.jsonc
npm run db:migrate:local
```

Dashboard feature migrations (required after pull):

- `migrations/0013_dashboard_features.sql` — `opportunity_plans` status / owner / effort / impact / suggested fields / timestamps
- `migrations/0014_client_notes.sql` — `brands.client_notes` for client reporting notes

```bash
# local
npm run db:migrate:local

# production
npm run db:migrate:remote

# staging (preview env)
npm run db:migrate:staging
```

Local KV / R2 / Queue IDs can stay as placeholders for `next dev`. Wrangler still needs a real D1 `database_id` once you create the database.

Without a Queue consumer (local Node), runs still process when the run poll hits `GET /api/runs/[id]`, or you can `POST /api/internal/process-run` with `{ "runId": "..." }` and Bearer `INTERNAL_PROCESS_SECRET`.

### Workers runtime preview

```bash
npm run preview
```

This runs `opennextjs-cloudflare build` then `opennextjs-cloudflare preview`. The custom entry is `worker.ts` (fetch + Queue consumer + scheduled).

## Friday cron (tenant timezone)

Wrangler triggers an **hourly** cron (`0 * * * *`). The scheduled handler (and `POST /api/cron/friday`) walks workspaces and **only enqueues** brands when the workspace `timezone` is **Friday 06:00 local** (06:00–06:59).

- Set timezone under **Settings → Workspace** (IANA name, e.g. `America/New_York`).
- Production: Queue consumer processes `citebrief-runs`.
- Local/manual: `POST /api/cron/friday?force=1` with Bearer `CRON_SECRET` enqueues every active brand (skips the Friday 06:00 window check).

This is not a single fixed UTC “Friday stub”; each tenant’s Friday morning is respected.

## Live engines

Adapters live in `src/lib/engine-adapters.ts`. Product soft-fail cache is D1 `engine_cache` (wins for repeated prompt×engine). Gateway edge cache is additive via `cache_policy`. Soft-fail ≥4/5 is unchanged in `processRun`. Production adapters should call Cloudflare AI Gateway, not provider APIs directly.

| Engine | Gateway path / binding | Behavior when unset |
|---|---|---|
| ChatGPT | AI Gateway OpenAI provider-native route | Deterministic stub |
| Gemini | AI Gateway Google AI Studio / Vertex provider-native route | Deterministic stub |
| Grok | AI Gateway xAI / Grok provider-native route | Deterministic stub |
| AI Overviews | `BROWSER` binding and/or Browser Rendering API | Deterministic stub |

The app should keep provider credentials in Cloudflare AI Gateway stored keys or unified billing where available. Do not make individual provider keys first-class Worker secrets. Perplexity is not part of the default engine set because it is not available in the current Cloudflare AI Gateway provider-native/unified-billing setup used by CiteBrief.

Live calls that error fall back to the stub for that prompt so a single flaky provider does not blank the run.

## Dodo (`@dodopayments/hono`)

- Agency checkout: `GET /api/checkout?plan=` (auth + metadata) uses `@dodopayments/core` `createCheckoutSession` when `DODO_PAYMENTS_API_KEY` is live.
- Official Hono Checkout mount: `/api/checkout/hono` (static GET / session POST).
- Webhooks: `/api/webhooks/dodo` uses `@dodopayments/hono` `Webhooks` when `DODO_PAYMENTS_WEBHOOK_KEY` is live; stub mode accepts payloads for local idempotency tests.
- Optional product IDs: `DODO_PRODUCT_STARTER`, `DODO_PRODUCT_AGENCY`, `DODO_PRODUCT_STUDIO` (fallback `citebrief_{plan}`).

## Wrangler / Cloudflare setup

1. Create resources (names can match the stubs in `wrangler.jsonc`):

```bash
npx wrangler d1 create citebrief
npx wrangler kv namespace create KV
npx wrangler r2 bucket create citebrief-reports
npx wrangler queues create citebrief-runs
```

2. Paste the D1 `database_id` and KV `id` into `wrangler.jsonc`.
3. Apply migrations:

```bash
npm run db:migrate:remote
```

4. Put secrets on the Worker (never commit them):

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put BETTER_AUTH_URL
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put DODO_PAYMENTS_API_KEY
npx wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY
npx wrangler secret put DODO_PAYMENTS_ENVIRONMENT
npx wrangler secret put INTERNAL_PROCESS_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put INTERNAL_ADMIN_SECRET
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put AI_GATEWAY_ID
npx wrangler secret put CF_AI_GATEWAY_TOKEN
# optional product IDs
npx wrangler secret put DODO_PRODUCT_STARTER
npx wrangler secret put DODO_PRODUCT_AGENCY
npx wrangler secret put DODO_PRODUCT_STUDIO
npx wrangler secret put DODO_PRODUCT_EXTRA_BRAND
npx wrangler secret put DODO_PRODUCT_EXTRA_RUN
```

5. Point the Worker route at `getcitebrief.com`. Optionally 301 `citebrief.xyz` to the canonical host in Cloudflare DNS / Redirect Rules.

6. Deploy:

```bash
npm run deploy
```

`BETTER_AUTH_URL` must be the single canonical public origin, for example `https://getcitebrief.com`. Optional domains such as `citebrief.xyz` should redirect there and must not participate in auth/session sharing.

### GitHub Actions

`.github/workflows/deploy.yml` deploys on push (and `workflow_dispatch`) of that branch:

| Branch | Wrangler env | Worker | `BETTER_AUTH_URL` | D1 migrations |
|---|---|---|---|---|
| `main` | default | `citebrief` | `https://getcitebrief.com` | `wrangler d1 migrations apply citebrief --remote` |
| `development` | `--env preview` (staging) | `citebrief-preview` | `https://citebrief.sarmaasis.workers.dev` | `wrangler d1 migrations apply citebrief-staging --remote --env preview` |

Create the staging database once (do not reuse the production D1 id):

```bash
npx wrangler d1 create citebrief-staging
```

Paste the returned `database_id` into `wrangler.jsonc` `env.preview.d1_databases`, and/or set the GitHub Actions **variable** `STAGING_D1_DATABASE_ID`. Staging CI fails if the id is still the placeholder or matches production.

Required **GitHub** secrets (not app secrets):

| Secret | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Workers deploy + D1 migrate (both envs) |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |

Optional **GitHub** variable: `STAGING_D1_DATABASE_ID` (overrides the wrangler placeholder before staging migrate).

Put Worker app secrets with `npx wrangler secret put …` (and again with `--env preview` for staging). Do not commit `.dev.vars`.

Local staging: `npm run db:migrate:staging` then `npm run deploy:staging`.

## Required secrets

| Secret | Purpose | Stub / notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | Session signing | Required. Use a long random string. |
| `BETTER_AUTH_URL` | Single canonical auth/app origin | `http://localhost:3000` locally |
| `GOOGLE_CLIENT_ID` | Google OAuth | Stub until you add a Google client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Stub until you add a Google client |
| `EMAIL` binding | Cloudflare Email Service outbound | `wrangler.jsonc` `send_email`. Production fails closed if missing. |
| `CF_EMAIL_FROM` | Default From | Worker var, not a secret. Default `CiteBrief <auth@getcitebrief.com>` |
| `DODO_PAYMENTS_API_KEY` | Checkout | Stub uses local success URL |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Webhook verify | Stub accepts payloads |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` or `live_mode` | `test_mode` |
| `DODO_PRODUCT_*` | Dodo product IDs | Optional; fallback `citebrief_{plan}` |
| `INTERNAL_PROCESS_SECRET` | Bearer for `/api/internal/process-run` | Required outside development |
| `CRON_SECRET` | Bearer for `/api/cron/friday` | Required outside development |
| `INTERNAL_ADMIN_SECRET` | Bearer for `/api/internal/admin/*` | Local: Bearer `dev-admin` when unset |
| `CF_ACCOUNT_ID` | Cloudflare account for AI Gateway / Browser Rendering | Stub adapters when unset |
| `AI_GATEWAY_ID` | Cloudflare AI Gateway id | Stub adapters when unset |
| `CF_AI_GATEWAY_TOKEN` | Scoped token for AI Gateway / Workers AI calls | Stub adapters when unset |
| `BROWSER` | Browser Rendering binding for AI Overviews | Optional if using browser binding |
| `DODO_PRODUCT_EXTRA_BRAND` | Extra brand addon product id | Placeholder `citebrief_extra_brand` |
| `DODO_PRODUCT_EXTRA_RUN` | Extra run meter/product id | Placeholder `citebrief_extra_run` |

Auth is created inside the request from `env.DB`. Do not cache a global D1 binding.

## Bindings

| Binding | Type | Use |
|---|---|---|
| `DB` | D1 | Better Auth + product tables |
| `KV` | KV | Better Auth rate limit / session cache |
| `R2` | R2 | Report PDFs (`reports/{workspace}/{brand}/{yyyy-mm-dd}.pdf`) |
| `RUNS_QUEUE` | Queue producer + consumer | Engine runs (`citebrief-runs`; consumer in `worker.ts`) |
| `BROWSER` | Browser Rendering | Optional AI Overviews path |
| `EMAIL` | Email Service (`send_email`) | Transactional mail: auth, invites, Friday send, dunning |

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Next.js local server |
| `npm run build` | Next.js production build |
| `npm test` | Unit checks in `test/*.test.ts` |
| `npm run preview` | OpenNext build + local Workers runtime |
| `npm run deploy` | OpenNext build + deploy to production Workers |
| `npm run deploy:staging` | OpenNext build + deploy `--env preview` (staging) |
| `npm run db:migrate:local` | Apply D1 migrations locally (includes `0013` opportunity statuses + `0014` client notes) |
| `npm run db:migrate:remote` | Apply production D1 migrations remotely |
| `npm run db:migrate:staging` | Apply `citebrief-staging` migrations (`--env preview`) |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` |

## Design

Tokens live in `design/tokens.css` (`--cb-*`). App CSS maps them into Tailwind v4 `@theme`. Paper `#FAFAF8`, ink `#0B3D2E`. No purple. No gradients.

## Internal admin

Bearer `INTERNAL_ADMIN_SECRET` (or `dev-admin` in local development):

| Route | What |
|---|---|
| `POST /api/internal/admin/impersonate` | `{ "workspaceId" }` sets signed act-as cookie |
| `DELETE /api/internal/admin/impersonate` | Clear act-as |
| `GET /api/internal/admin/cogs/[runId]` | COGS estimate for a run |
| `POST /api/internal/admin/webhooks/replay` | Re-apply stored Dodo webhook payload |

UI scratchpad: `/app/admin` (still requires the Bearer secret on each action).
