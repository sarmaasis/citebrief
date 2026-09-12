# CiteBrief

AI-search visibility reports for agencies. Every Friday: a white-label PDF that shows whether the client was named in ChatGPT, Perplexity, Gemini, and Google AI Overviews.

**Canonical domain:** [getcitebrief.com](https://getcitebrief.com). Optional redirect: `citebrief.xyz`.

Stack: Next.js App Router on Cloudflare Workers via `@opennextjs/cloudflare` (not Pages) · Better Auth · Dodo Payments (`@dodopayments/hono`) · D1 / KV / R2 / Queues

See [PRODUCT.md](./PRODUCT.md) and [DESIGN.md](./DESIGN.md). Design tokens use the `--cb-*` prefix.

## Phases

**Phase 1:** OpenNext Worker, Better Auth, D1 schema, marketing + app shells.

**Phase 2:** Brands CRUD, 20-prompt editor with 4+4+4+4+4 mix and vanity rejection, onboarding (6 fields to generated 20), run enqueue + poll UI, brand home.

**Phase 3:** Engine fan-out (stub + live adapters), run_rows, soft-fail ≥3/4, HTML+PDF to R2, in-app report viewer.

**Phase 4:** Dodo checkout/webhooks (official Hono where live keys exist), billing UI, brand kit, client link `/r/[token]`, run/brand caps, report email send.

**Phase 5:** History/MoM sparkline, members invite stub, workspace settings, Friday cron (tenant timezone), marketing `/report` + legal pages, StatusPill token polish.

**Later follow-ups (this work):** Live engine APIs when keys are set, Queue consumer Worker for `citebrief-runs`, `@dodopayments/hono` Checkout/Webhooks mounts, Friday 06:00 per workspace timezone, CC-client Dialog.

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

Prompt generation fills the PRODUCT.md templates when no LLM key is set. Set `OPENAI_API_KEY` to use a live writer.

## Local setup

Requires Node 20+.

```bash
npm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set at least `BETTER_AUTH_SECRET` (32+ random characters). Outside development, also set `INTERNAL_PROCESS_SECRET` and `CRON_SECRET` (Bearer auth for `/api/internal/process-run` and `/api/cron/friday`). Stub values are fine for Google, Resend, Dodo, and engines until you have live keys.

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

Adapters live in `src/lib/engine-adapters.ts`. Soft-fail ≥3/4 is unchanged in `processRun`.

| Engine | Secret / binding | Behavior when unset |
|---|---|---|
| ChatGPT | `OPENAI_API_KEY` | Deterministic stub |
| Perplexity | `PERPLEXITY_API_KEY` | Deterministic stub |
| Gemini | `GEMINI_API_KEY` | Deterministic stub |
| AI Overviews | `BROWSER` binding and/or `CF_ACCOUNT_ID` + `CF_API_TOKEN` | Deterministic stub |

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
npx wrangler secret put BETTER_AUTH_TRUSTED_ORIGINS
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put RESEND_FROM
npx wrangler secret put DODO_PAYMENTS_API_KEY
npx wrangler secret put DODO_PAYMENTS_WEBHOOK_KEY
npx wrangler secret put DODO_PAYMENTS_ENVIRONMENT
npx wrangler secret put INTERNAL_PROCESS_SECRET
npx wrangler secret put CRON_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put PERPLEXITY_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put CF_API_TOKEN
# optional product IDs
npx wrangler secret put DODO_PRODUCT_STARTER
npx wrangler secret put DODO_PRODUCT_AGENCY
npx wrangler secret put DODO_PRODUCT_STUDIO
```

5. Point the Worker route at `getcitebrief.com`. Optionally 301 `citebrief.xyz` to the canonical host in Cloudflare DNS / Redirect Rules.

6. Deploy:

```bash
npm run deploy
```

`BETTER_AUTH_URL` must be the public origin, for example `https://getcitebrief.com`.

## Required secrets

| Secret | Purpose | Stub / notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | Session signing | Required. Use a long random string. |
| `BETTER_AUTH_URL` | Auth base URL | `http://localhost:3000` locally |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Extra allowed origins | Optional. Comma-separated. |
| `GOOGLE_CLIENT_ID` | Google OAuth | Stub until you add a Google client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Stub until you add a Google client |
| `RESEND_API_KEY` | Magic-link + report email | `stub` logs and skips send |
| `RESEND_FROM` | From address | Defaults to `CiteBrief <auth@getcitebrief.com>` |
| `DODO_PAYMENTS_API_KEY` | Checkout | Stub uses local success URL |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Webhook verify | Stub accepts payloads |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` or `live_mode` | `test_mode` |
| `DODO_PRODUCT_*` | Dodo product IDs | Optional; fallback `citebrief_{plan}` |
| `INTERNAL_PROCESS_SECRET` | Bearer for `/api/internal/process-run` | Required outside development |
| `CRON_SECRET` | Bearer for `/api/cron/friday` | Required outside development |
| `OPENAI_API_KEY` | ChatGPT engine (+ prompt writer) | Stub adapters when unset |
| `PERPLEXITY_API_KEY` | Perplexity Sonar | Stub when unset |
| `GEMINI_API_KEY` | Gemini + Search | Stub when unset |
| `CF_ACCOUNT_ID` / `CF_API_TOKEN` | Browser Rendering for AIO | Optional if `BROWSER` binding works |

Auth is created inside the request from `env.DB`. Do not cache a global D1 binding.

## Bindings

| Binding | Type | Use |
|---|---|---|
| `DB` | D1 | Better Auth + product tables |
| `KV` | KV | Better Auth rate limit / session cache |
| `R2` | R2 | Report PDFs (`reports/{workspace}/{brand}/{yyyy-mm-dd}.pdf`) |
| `RUNS_QUEUE` | Queue producer + consumer | Engine runs (`citebrief-runs`; consumer in `worker.ts`) |
| `BROWSER` | Browser Rendering | Optional AI Overviews path |

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Next.js local server |
| `npm run build` | Next.js production build |
| `npm test` | Prompt, extractor, and Friday-TZ unit checks |
| `npm run preview` | OpenNext build + local Workers runtime |
| `npm run deploy` | OpenNext build + deploy to Workers |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations remotely |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` |

## Design

Tokens live in `design/tokens.css` (`--cb-*`). App CSS maps them into Tailwind v4 `@theme`. Paper `#FAFAF8`, ink `#0B3D2E`. No purple. No gradients.
