import { NextResponse } from "next/server";
import { clientIp, isProductionRuntime } from "@/lib/runtime-env";

export type RateLimitStore = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

export type RateLimitSpec = {
  bucket: string;
  limit: number;
  windowMs: number;
};

export const RATE_LIMITS = {
  auth: { bucket: "auth", limit: 30, windowMs: 60_000 },
  runCreate: { bucket: "run", limit: 10, windowMs: 60 * 60_000 },
  reportSend: { bucket: "send", limit: 20, windowMs: 60 * 60_000 },
  invite: { bucket: "invite", limit: 10, windowMs: 60 * 60_000 },
  publicReport: { bucket: "share", limit: 60, windowMs: 60_000 },
  internal: { bucket: "internal", limit: 30, windowMs: 60_000 },
  export: { bucket: "export", limit: 5, windowMs: 60 * 60_000 },
  shareManage: { bucket: "share-manage", limit: 20, windowMs: 60 * 60_000 },
  billing: { bucket: "billing", limit: 20, windowMs: 60 * 60_000 },
} as const satisfies Record<string, RateLimitSpec>;

export function rateLimitWindow(now: number, windowMs: number) {
  return Math.floor(now / windowMs);
}

export function rateLimitKey(spec: RateLimitSpec, subject: string, now = Date.now()) {
  return `rl:${spec.bucket}:${subject}:${rateLimitWindow(now, spec.windowMs)}`;
}

export function rateLimitDecision(count: number, limit: number) {
  const ok = count < limit;
  return {
    ok,
    remaining: Math.max(0, limit - count - (ok ? 1 : 0)),
  };
}

export async function consumeRateLimit(
  store: RateLimitStore | undefined,
  spec: RateLimitSpec,
  subject: string,
  now = Date.now(),
): Promise<{ ok: boolean; remaining: number; retryAfterSec: number; count: number }> {
  const windowEnd = (rateLimitWindow(now, spec.windowMs) + 1) * spec.windowMs;
  const retryAfterSec = Math.max(1, Math.ceil((windowEnd - now) / 1000));
  if (!store) {
    return { ok: true, remaining: spec.limit, retryAfterSec: 0, count: 0 };
  }

  const key = rateLimitKey(spec, subject, now);
  const current = Number((await store.get(key)) || "0") || 0;
  if (current >= spec.limit) {
    return { ok: false, remaining: 0, retryAfterSec, count: current };
  }

  const ttl = Math.max(60, Math.ceil(spec.windowMs / 1000) + 5);
  await store.put(key, String(current + 1), { expirationTtl: ttl });
  return {
    ok: true,
    remaining: Math.max(0, spec.limit - current - 1),
    retryAfterSec,
    count: current + 1,
  };
}

export function rateLimitResponse(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests. Wait and try again." },
    {
      status: 429,
      headers: {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterSec))),
        "Cache-Control": "no-store",
      },
    },
  );
}

export function rateLimitUnavailableResponse() {
  return NextResponse.json(
    { error: "Rate limiting is unavailable. Try again shortly." },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function consumeRouteRateLimit(
  request: Request,
  env: CloudflareEnv | undefined,
  spec: RateLimitSpec,
  subject?: string,
): Promise<NextResponse | null> {
  const production = isProductionRuntime(env);
  if (!env?.KV) {
    if (production) {
      console.error("[rate-limit] KV missing in production; denying request");
      return rateLimitUnavailableResponse();
    }
    return null;
  }
  const id = subject || clientIp(request);
  const result = await consumeRateLimit(env.KV, spec, id);
  if (result.ok) return null;
  return rateLimitResponse(result.retryAfterSec);
}
