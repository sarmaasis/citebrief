/// <reference types="@cloudflare/workers-types" />

interface CloudflareEnv {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  RUNS_QUEUE: Queue;
  ASSETS: Fetcher;
  WORKER_SELF_REFERENCE: Fetcher;
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
}
