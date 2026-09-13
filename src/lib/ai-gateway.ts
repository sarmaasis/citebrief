import { isStubSecret } from "@/lib/billing";

export type AiGatewayProvider = "openai" | "perplexity" | "google" | "anthropic" | "xai" | "workers-ai";

export type AiGatewayCachePolicy = "fresh" | "allow_24h";

export type AiGatewayMetadata = {
  workspace_id?: string;
  brand_id?: string;
  run_id?: string;
  engine?: string;
  plan?: string;
  prompt_hash?: string;
  cache_policy?: AiGatewayCachePolicy;
};

export type AiGatewayRequestArgs = {
  env?: CloudflareEnv;
  provider: AiGatewayProvider;
  /** Path after the provider segment, e.g. `/chat/completions` or `/responses`. */
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  metadata?: AiGatewayMetadata;
};

export type AiGatewaySuccess = {
  stub: false;
  text: string;
  raw: unknown;
  gatewayRequestId: string | null;
};

export type AiGatewayStub = {
  stub: true;
  reason: string;
};

export type AiGatewayResult = AiGatewaySuccess | AiGatewayStub;

export class AiGatewayError extends Error {
  status: number;
  softFail: boolean;
  gatewayRequestId: string | null;

  constructor(message: string, opts: { status?: number; softFail?: boolean; gatewayRequestId?: string | null } = {}) {
    super(message);
    this.name = "AiGatewayError";
    this.status = opts.status ?? 502;
    this.softFail = opts.softFail ?? true;
    this.gatewayRequestId = opts.gatewayRequestId ?? null;
  }
}

function readEnv(env: CloudflareEnv | undefined, key: keyof CloudflareEnv | string): string | undefined {
  const fromBinding = env ? (env as unknown as Record<string, unknown>)[key] : undefined;
  if (typeof fromBinding === "string" && fromBinding.length > 0) return fromBinding;
  const fromProcess = process.env[String(key)];
  return fromProcess || undefined;
}

/**
 * True when CF_ACCOUNT_ID, AI_GATEWAY_ID, and CF_AI_GATEWAY_TOKEN are all set
 * and not stub values. Adapters should use deterministic stubs otherwise.
 */
export function isAiGatewayConfigured(env?: CloudflareEnv): boolean {
  const accountId = readEnv(env, "CF_ACCOUNT_ID");
  const gatewayId = readEnv(env, "AI_GATEWAY_ID");
  const token = readEnv(env, "CF_AI_GATEWAY_TOKEN");
  return (
    !isStubSecret(accountId) &&
    !isStubSecret(gatewayId) &&
    !isStubSecret(token)
  );
}

const PROVIDER_SEGMENT: Record<AiGatewayProvider, string> = {
  openai: "openai",
  perplexity: "perplexity-ai",
  google: "google-ai-studio",
  anthropic: "anthropic",
  xai: "grok",
  "workers-ai": "workers-ai",
};

function gatewayBaseUrl(accountId: string, gatewayId: string, provider: AiGatewayProvider): string {
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${PROVIDER_SEGMENT[provider]}`;
}

function extractText(provider: AiGatewayProvider, data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = data as Record<string, unknown>;

  if (typeof obj.output_text === "string" && obj.output_text.trim()) {
    return obj.output_text.trim();
  }

  if (Array.isArray(obj.output)) {
    const chunks: string[] = [];
    for (const item of obj.output as Array<{ content?: Array<{ text?: string }> }>) {
      for (const part of item.content || []) {
        if (part.text) chunks.push(part.text);
      }
    }
    const joined = chunks.join("\n").trim();
    if (joined) return joined;
  }

  const choices = obj.choices as Array<{ message?: { content?: string } }> | undefined;
  const choiceText = choices?.[0]?.message?.content?.trim();
  if (choiceText) return choiceText;

  if (provider === "anthropic") {
    const content = obj.content as Array<{ type?: string; text?: string }> | undefined;
    const text = (content || [])
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n")
      .trim();
    if (text) return text;
  }

  if (provider === "google") {
    const candidates = obj.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    const text = candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim();
    if (text) return text;
  }

  if (provider === "workers-ai") {
    const result = obj.result as { response?: string } | string | undefined;
    if (typeof result === "string" && result.trim()) return result.trim();
    if (result && typeof result === "object" && typeof result.response === "string") {
      return result.response.trim();
    }
  }

  return "";
}

function requestIdFromResponse(response: Response, data: unknown): string | null {
  const headerId =
    response.headers.get("cf-aig-request-id") ||
    response.headers.get("cf-request-id") ||
    response.headers.get("x-request-id");
  if (headerId) return headerId;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (typeof obj.id === "string") return obj.id;
    if (typeof obj.request_id === "string") return obj.request_id;
  }
  return null;
}

/**
 * Single entry point for all LLM provider calls.
 * Provider credentials live in Cloudflare AI Gateway stored keys / unified billing.
 * App code only needs CF_ACCOUNT_ID, AI_GATEWAY_ID, CF_AI_GATEWAY_TOKEN.
 *
 * Cache note: D1 `engine_cache` is the product soft-fail cache and wins for
 * repeated prompt×engine answers inside CiteBrief. Gateway cache (`allow_24h`)
 * is additive at the edge and does not replace D1.
 */
export async function aiGatewayRequest(args: AiGatewayRequestArgs): Promise<AiGatewayResult> {
  if (!isAiGatewayConfigured(args.env)) {
    return { stub: true, reason: "AI Gateway config missing or stub" };
  }

  const accountId = readEnv(args.env, "CF_ACCOUNT_ID")!;
  const gatewayId = readEnv(args.env, "AI_GATEWAY_ID")!;
  const token = readEnv(args.env, "CF_AI_GATEWAY_TOKEN")!;

  const path = args.path.startsWith("/") ? args.path : `/${args.path}`;
  const url = `${gatewayBaseUrl(accountId, gatewayId, args.provider)}${path}`;

  const meta = args.metadata || {};
  const cachePolicy = meta.cache_policy || "fresh";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "cf-aig-authorization": `Bearer ${token}`,
    ...(args.headers || {}),
  };

  const metadataPayload: Record<string, string> = {};
  for (const key of ["workspace_id", "brand_id", "run_id", "engine", "plan", "prompt_hash"] as const) {
    const value = meta[key];
    if (value) metadataPayload[key] = value;
  }
  metadataPayload.cache_policy = cachePolicy;
  headers["cf-aig-metadata"] = JSON.stringify(metadataPayload);

  if (cachePolicy === "fresh") {
    headers["cf-aig-cache-ttl"] = "0";
    headers["cf-aig-skip-cache"] = "true";
  } else {
    headers["cf-aig-cache-ttl"] = "86400";
  }

  const response = await fetch(url, {
    method: args.method || "POST",
    headers,
    body: args.body === undefined ? undefined : JSON.stringify(args.body),
  });

  const rawText = await response.text();
  let data: unknown = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }

  const gatewayRequestId = requestIdFromResponse(response, data);

  if (!response.ok) {
    throw new AiGatewayError(
      `AI Gateway ${args.provider} ${response.status}: ${rawText.slice(0, 400)}`,
      { status: response.status, softFail: true, gatewayRequestId },
    );
  }

  const text = extractText(args.provider, data);
  if (!text) {
    throw new AiGatewayError(`AI Gateway ${args.provider} response missing text`, {
      softFail: true,
      gatewayRequestId,
    });
  }

  return {
    stub: false,
    text,
    raw: data,
    gatewayRequestId,
  };
}

export function promptHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
