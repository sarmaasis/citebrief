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
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  BETTER_AUTH_TRUSTED_ORIGINS?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM?: string;
  DODO_PAYMENTS_API_KEY: string;
  DODO_PAYMENTS_WEBHOOK_KEY: string;
  DODO_PAYMENTS_ENVIRONMENT: "test_mode" | "live_mode" | string;
  DODO_PRODUCT_STARTER?: string;
  DODO_PRODUCT_AGENCY?: string;
  DODO_PRODUCT_STUDIO?: string;
  INTERNAL_PROCESS_SECRET?: string;
  CRON_SECRET?: string;
  NEXTJS_ENV?: string;
  OPENAI_API_KEY?: string;
  PERPLEXITY_API_KEY?: string;
  GEMINI_API_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}
