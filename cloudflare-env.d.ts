/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  RUNS_QUEUE: Queue;
  ASSETS: Fetcher;
  WORKER_SELF_REFERENCE: Fetcher;
  /** Optional Cloudflare Browser Rendering binding for AI Overviews. */
  BROWSER?: Fetcher;
  /** Cloudflare Email Service send binding (`wrangler.jsonc` send_email.name = EMAIL). */
  EMAIL?: {
    send(message: {
      to: string | { email: string; name?: string } | Array<string | { email: string; name?: string }>;
      from: string | { email: string; name?: string };
      subject: string;
      html?: string;
      text?: string;
    }): Promise<{ messageId?: string } | void>;
  };
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  /** Default From for CiteBrief sender. Not a secret. Studio custom sender still uses workspace domain. */
  CF_EMAIL_FROM?: string;
  DODO_PAYMENTS_API_KEY: string;
  DODO_PAYMENTS_WEBHOOK_KEY: string;
  DODO_PAYMENTS_ENVIRONMENT: "test_mode" | "live_mode" | string;
  DODO_PRODUCT_STARTER?: string;
  DODO_PRODUCT_AGENCY?: string;
  DODO_PRODUCT_STUDIO?: string;
  DODO_PRODUCT_ENTERPRISE?: string;
  DODO_PRODUCT_EXTRA_BRAND?: string;
  DODO_PRODUCT_EXTRA_RUN?: string;
  DODO_PRODUCT_EXTRA_SEAT?: string;
  DODO_PRODUCT_PREMIUM_ENGINE?: string;
  DODO_PRODUCT_STARTER_ANNUAL?: string;
  DODO_PRODUCT_AGENCY_ANNUAL?: string;
  DODO_PRODUCT_STUDIO_ANNUAL?: string;
  DODO_PRODUCT_ENTERPRISE_ANNUAL?: string;
  INTERNAL_PROCESS_SECRET?: string;
  CRON_SECRET?: string;
  INTERNAL_ADMIN_SECRET?: string;
  NEXTJS_ENV?: string;
  /** Cloudflare account id for AI Gateway and Browser Rendering. */
  CF_ACCOUNT_ID?: string;
  /** Cloudflare AI Gateway id. Missing/stub → deterministic engine stubs. */
  AI_GATEWAY_ID?: string;
  /** Scoped token for AI Gateway / Workers AI calls. */
  CF_AI_GATEWAY_TOKEN?: string;
  /** Optional token for Browser Rendering REST (AIO). Not used for LLM providers. */
  CF_API_TOKEN?: string;
}
