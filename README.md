# CiteBrief

AI-search visibility reports for agencies. Every Friday: a white-label PDF that shows whether the client was named in ChatGPT, Perplexity, Gemini, and Google AI Overviews.

**Canonical domain:** [getcitebrief.com](https://getcitebrief.com). Optional redirect: `citebrief.xyz`.

Stack: Next.js App Router on Cloudflare Workers via `@opennextjs/cloudflare` (not Pages) · Better Auth · Dodo Payments · D1 / KV / R2 / Queues

See [PRODUCT.md](./PRODUCT.md) and [DESIGN.md](./DESIGN.md). Design tokens use the `--cb-*` prefix.

## Phase 1 (this repo)

Foundation only:

- OpenNext Worker config (`wrangler.jsonc`) with `nodejs_compat`
- D1 / KV / R2 / Queue binding stubs
- D1 schema: Better Auth tables plus workspaces, brands, prompts, runs, run_rows, reports, subscriptions, webhook_events
- Better Auth + `better-auth-cloudflare` initialized per request on D1
- Email/password, magic link (Resend stub), Google OAuth stub
- Marketing shell (`/`, `/pricing`) and app shell (`/app`)
- Auth pages (`/login`, `/signup`) and `/api/auth/*`

Later phases (not in this PR): brands/prompts, engines/PDF, Dodo, white-label/cron.

## Local setup

Requires Node 20+.

```bash
npm install
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set at least `BETTER_AUTH_SECRET` (32+ random characters). Stub values are fine for Google, Resend, and Dodo until you have live keys.

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

### Workers runtime preview

```bash
npm run preview
```

This runs `opennextjs-cloudflare build` then `opennextjs-cloudflare preview`.

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
```

5. Point the Worker route at `getcitebrief.com`. Optionally 301 `citebrief.xyz` to the canonical host in Cloudflare DNS / Redirect Rules.

6. Deploy:

```bash
npm run deploy
```

`BETTER_AUTH_URL` must be the public origin, for example `https://getcitebrief.com`.

## Required secrets

| Secret | Purpose | Phase 1 stub |
|---|---|---|
| `BETTER_AUTH_SECRET` | Session signing | Required. Use a long random string. |
| `BETTER_AUTH_URL` | Auth base URL | `http://localhost:3000` locally |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Extra allowed origins | Optional. Comma-separated. |
| `GOOGLE_CLIENT_ID` | Google OAuth | Stub until you add a Google client |
| `GOOGLE_CLIENT_SECRET` | Google OAuth | Stub until you add a Google client |
| `RESEND_API_KEY` | Magic-link email | `stub` logs and skips send |
| `RESEND_FROM` | From address | Defaults to `CiteBrief <auth@getcitebrief.com>` |
| `DODO_PAYMENTS_API_KEY` | Checkout (Phase 3) | Stub |
| `DODO_PAYMENTS_WEBHOOK_KEY` | Webhook verify (Phase 3) | Stub |
| `DODO_PAYMENTS_ENVIRONMENT` | `test_mode` or `live_mode` | `test_mode` |

Auth is created inside the request from `env.DB`. Do not cache a global D1 binding.

## Bindings

| Binding | Type | Use |
|---|---|---|
| `DB` | D1 | Better Auth + product tables |
| `KV` | KV | Better Auth rate limit / session cache |
| `R2` | R2 | Report PDFs (`reports/{workspace}/{brand}/{yyyy-mm-dd}.pdf`) |
| `RUNS_QUEUE` | Queue producer | Engine runs (consumer is a later Worker) |

## Scripts

| Script | What |
|---|---|
| `npm run dev` | Next.js local server |
| `npm run build` | Next.js production build |
| `npm run preview` | OpenNext build + local Workers runtime |
| `npm run deploy` | OpenNext build + deploy to Workers |
| `npm run db:migrate:local` | Apply D1 migrations locally |
| `npm run db:migrate:remote` | Apply D1 migrations remotely |
| `npm run cf-typegen` | Regenerate `cloudflare-env.d.ts` |

## Design

Tokens live in `design/tokens.css` (`--cb-*`). App CSS maps them into Tailwind v4 `@theme`. Paper `#FAFAF8`, ink `#0B3D2E`. No purple. No gradients.
