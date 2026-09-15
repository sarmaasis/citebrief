import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import { runs } from "@/db/schema";
import { isStubSecret } from "@/lib/billing";

export type AiGatewayProvider = "openai" | "google" | "anthropic" | "xai" | "workers-ai";

export type AiGatewayCachePolicy = "fresh" | "allow_24h";

export type AiGatewayMetadata = {
  workspace_id?: string;
  brand_id?: string;
  run_id?: string;
  engine?: string;
  plan?: string;
  prompt_hash?: string;
  cache_policy?: AiGatewayCachePolicy;
  max_gateway_requests?: number;
};

export type AiGatewayRequestArgs = {
  env?: CloudflareEnv;
  /** Optional DB for durable per-run gateway budget across isolate restarts. */
  db?: Database;
  provider: AiGatewayProvider;
  /** Path after the provider segment, e.g. `/chat/completions` or `/responses`. */
  path: string;
  method?: "GET" | "POST";
  body?: unknown;
  headers?: Record<string, string>;
  metadata?: AiGatewayMetadata;
  /** Production LLM runs must use a search/grounding tool, not chat-only. */
  requireWebSearch?: boolean;
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
  google: "google-ai-studio",
  anthropic: "anthropic",
  xai: "grok",
  "workers-ai": "workers-ai",
};

const gatewayCallsByRun = new Map<string, number>();

export function resetGatewayRunBudget(runId: string) {
  gatewayCallsByRun.delete(runId);
}

/** Load durable count from D1 so a restarted queue consumer keeps the same budget. */
export async function hydrateGatewayRunBudget(db: Database, runId: string) {
  const [row] = await db
    .select({ gatewayCalls: runs.gatewayCalls })
    .from(runs)
    .where(eq(runs.id, runId))
    .limit(1);
  const n = Number(row?.gatewayCalls ?? 0);
  if (n > 0) gatewayCallsByRun.set(runId, n);
  else gatewayCallsByRun.delete(runId);
}

export function gatewayRunCallCount(runId: string): number {
  return gatewayCallsByRun.get(runId) || 0;
}

export async function assertGatewayRunBudget(
  runId: string | undefined,
  cap: number | undefined,
  db?: Database,
) {
  if (!runId || !cap || cap <= 0) return;
  const next = (gatewayCallsByRun.get(runId) || 0) + 1;
  if (next > cap) {
    throw new AiGatewayError(`AI Gateway run budget exceeded (${cap} requests)`, { status: 429, softFail: true });
  }
  gatewayCallsByRun.set(runId, next);
  if (db) {
    await db.update(runs).set({ gatewayCalls: next }).where(eq(runs.id, runId));
  }
  if (next === 1 || next === cap || next % 5 === 0) {
    console.info(`[ai-gateway] run ${runId} ${next}/${cap}`);
  }
}

function gatewayBaseUrl(accountId: string, gatewayId: string, provider: AiGatewayProvider): string {
  return `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/${PROVIDER_SEGMENT[provider]}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Cloudflare sometimes wraps Google generateContent in result/data. */
function unwrapGatewayPayload(data: unknown): Record<string, unknown> {
  const obj = asRecord(data);
  if (!obj) return {};
  for (const key of ["result", "data", "response"]) {
    const inner = asRecord(obj[key]);
    if (!inner) continue;
    if (
      inner.candidates ||
      inner.output ||
      inner.groundingMetadata ||
      inner.grounding_metadata ||
      inner.contents
    ) {
      return inner;
    }
  }
  return obj;
}

function googleCandidates(obj: Record<string, unknown>): Array<Record<string, unknown>> {
  const list = obj.candidates;
  if (!Array.isArray(list)) return [];
  return list.filter((item): item is Record<string, unknown> => Boolean(asRecord(item)));
}

function googleGroundingMeta(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!value) return null;
  return asRecord(value.groundingMetadata) || asRecord(value.grounding_metadata);
}

function hasNonEmptyGroundingSignal(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return true;
}

/**
 * Gemini 3 / AI Studio / Gateway may put search evidence in several shapes:
 * groundingMetadata, grounding_metadata, searchEntryPoint, google_search_call, citationMetadata.
 */
function googleResponseUsedSearch(data: unknown): boolean {
  const obj = unwrapGatewayPayload(data);
  if (googleGroundingMeta(obj)) return true;

  for (const candidate of googleCandidates(obj)) {
    const meta = googleGroundingMeta(candidate);
    if (meta && hasNonEmptyGroundingSignal(meta)) return true;
    if (asRecord(candidate.citationMetadata) || asRecord(candidate.citation_metadata)) return true;
    const content = asRecord(candidate.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      const rec = asRecord(part);
      if (!rec) continue;
      const fn = asRecord(rec.functionCall) || asRecord(rec.function_call);
      const fnName = typeof fn?.name === "string" ? fn.name : "";
      if (/google_search|googleSearch/i.test(fnName)) return true;
      if (rec.googleSearchCall || rec.google_search_call || rec.googleSearch || rec.google_search) return true;
    }
  }

  const blobs: unknown[] = [obj.output, obj.steps, obj.contents, obj.candidates];
  const stack = [...blobs];
  const seen = new Set<unknown>();
  while (stack.length) {
    const next = stack.pop();
    if (!next || typeof next !== "object" || seen.has(next)) continue;
    seen.add(next);
    if (Array.isArray(next)) {
      for (const item of next) stack.push(item);
      continue;
    }
    const rec = next as Record<string, unknown>;
    for (const [key, value] of Object.entries(rec)) {
      if (
        /groundingMetadata|grounding_metadata|webSearchQueries|web_search_queries|searchEntryPoint|search_entry_point|groundingChunks|grounding_chunks|google_search_call|googleSearchCall|google_search_result|googleSearchResult/i.test(
          key,
        ) &&
        hasNonEmptyGroundingSignal(value)
      ) {
        return true;
      }
      if (typeof rec.type === "string" && /google_search/i.test(rec.type)) return true;
      if (value && typeof value === "object") stack.push(value);
    }
  }

  return false;
}

export function googleSearchRequested(body: unknown): boolean {
  const obj = asRecord(body);
  if (!obj || !Array.isArray(obj.tools)) return false;
  return obj.tools.some((tool) => {
    const rec = asRecord(tool);
    if (!rec) return false;
    if (rec.google_search != null || rec.googleSearch != null) return true;
    return typeof rec.type === "string" && /google_search/i.test(rec.type);
  });
}

export function googleFinishReason(data: unknown): string {
  const candidate = googleCandidates(unwrapGatewayPayload(data))[0];
  const reason = candidate?.finishReason ?? candidate?.finish_reason;
  return typeof reason === "string" ? reason.toUpperCase() : "";
}

function urlsFromText(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s)\]}"']+/gi) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,;]+$/g, "")))];
}

function closeTruncatedJson(input: string): string {
  let s = input.trim();
  const stack: string[] = [];
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") stack.push("}");
    else if (ch === "[") stack.push("]");
    else if (ch === "}" || ch === "]") stack.pop();
  }
  if (inString) s += '"';
  return s + stack.reverse().join("");
}

/** Salvage truncated JSON / fence-wrapped model text. Returns original prose if not JSON. */
export function salvageGatewayText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || trimmed).trim();
  if (!/^[{[]/.test(candidate)) return trimmed;
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    const repaired = closeTruncatedJson(candidate);
    try {
      JSON.parse(repaired);
      return repaired;
    } catch {
      return trimmed;
    }
  }
}

/** True when the model text is a usable shortlist, not a mid-sentence MAX_TOKENS stub. */
export function isUsableShortlistText(text: string): boolean {
  const cleaned = salvageGatewayText(text).replace(/\s+/g, " ").trim();
  if (cleaned.length < 40) return false;
  if (/[,:]\s*$/.test(cleaned)) return false;
  if (/^[{[]/.test(cleaned)) {
    try {
      JSON.parse(cleaned);
      return true;
    } catch {
      return false;
    }
  }
  if (urlsFromText(cleaned).length > 0) return true;
  if (/shortlist\s*:/i.test(cleaned) && cleaned.split(/,|\n/).filter((part) => part.trim()).length >= 2) {
    return true;
  }
  const names = cleaned.match(/\b[A-Z][A-Za-z0-9.&-]{2,}\b/g) || [];
  return names.length >= 2 && /[.!?]"?$/.test(cleaned);
}

function googleCandidateText(data: unknown): string {
  const parts = asRecord(googleCandidates(unwrapGatewayPayload(data))[0]?.content)?.parts;
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      const rec = asRecord(part);
      return typeof rec?.text === "string" ? rec.text : "";
    })
    .join("\n")
    .trim();
}

function collectSearchSources(provider: AiGatewayProvider, data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const raw = data as Record<string, unknown>;
  const obj = provider === "google" ? unwrapGatewayPayload(data) : raw;
  const urls = new Set<string>();
  const addUrl = (value: unknown) => {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.add(value);
  };

  if (Array.isArray(obj.citations)) {
    for (const item of obj.citations) {
      if (typeof item === "string") addUrl(item);
      else if (item && typeof item === "object") {
        const cite = item as Record<string, unknown>;
        addUrl(cite.url || cite.uri);
      }
    }
  }

  if (Array.isArray(obj.output)) {
    for (const item of obj.output as Array<Record<string, unknown>>) {
      for (const part of (item.content as Array<Record<string, unknown>> | undefined) || []) {
        for (const annotation of (part.annotations as Array<Record<string, unknown>> | undefined) || []) {
          addUrl(annotation.url);
        }
      }
    }
  }

  if (provider === "anthropic") {
    for (const part of (obj.content as Array<Record<string, unknown>> | undefined) || []) {
      for (const citation of (part.citations as Array<Record<string, unknown>> | undefined) || []) {
        addUrl(citation.url);
      }
      const result = part.content;
      if (Array.isArray(result)) {
        for (const hit of result as Array<Record<string, unknown>>) {
          addUrl(hit.url);
        }
      }
    }
  }

  if (provider === "google") {
    for (const candidate of googleCandidates(obj)) {
      const meta = googleGroundingMeta(candidate) || {};
      const chunks = (meta.groundingChunks || meta.grounding_chunks) as Array<Record<string, unknown>> | undefined;
      for (const chunk of chunks || []) {
        const web = asRecord(chunk.web);
        addUrl(web?.uri || web?.url);
      }
      const citations = asRecord(candidate.citationMetadata) || asRecord(candidate.citation_metadata);
      const citeList = citations?.citations;
      if (Array.isArray(citeList)) {
        for (const cite of citeList) {
          const rec = asRecord(cite);
          addUrl(rec?.uri || rec?.url);
        }
      }
      const content = asRecord(candidate.content);
      const parts = Array.isArray(content?.parts) ? content.parts : [];
      for (const part of parts) {
        const rec = asRecord(part);
        if (typeof rec?.text === "string") {
          for (const url of urlsFromText(rec.text)) addUrl(url);
        }
        const annotations = Array.isArray(rec?.annotations) ? rec.annotations : [];
        for (const annotation of annotations) {
          const note = asRecord(annotation);
          addUrl(note?.url || note?.uri);
        }
      }
    }
  }

  return [...urls];
}

/**
 * True when the provider response shows a search/grounding tool actually ran.
 * Chat-only completions (no web_search_call / grounding / citations) return false.
 */
export function responseUsedWebSearch(provider: AiGatewayProvider, data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.output)) {
    const searched = (obj.output as Array<{ type?: string }>).some(
      (item) => typeof item?.type === "string" && /web_search/.test(item.type),
    );
    if (searched) return true;
  }

  if (Array.isArray(obj.citations) && obj.citations.length > 0) return true;

  const usage = obj.server_side_tool_usage;
  if (usage && typeof usage === "object") {
    if (Object.keys(usage as Record<string, unknown>).some((key) => /search/i.test(key))) {
      return true;
    }
  }

  if (provider === "anthropic") {
    const content = obj.content as Array<Record<string, unknown>> | undefined;
    if (
      (content || []).some((part) => {
        const type = String(part.type || "");
        if (type === "server_tool_use" || type === "web_search_tool_result") return true;
        return Array.isArray(part.citations) && part.citations.length > 0;
      })
    ) {
      return true;
    }
  }

  if (provider === "google") {
    if (googleResponseUsedSearch(data)) return true;
  }

  return collectSearchSources(provider, data).length > 0;
}

export function extractGatewayText(provider: AiGatewayProvider, data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const obj = provider === "google" ? unwrapGatewayPayload(data) : (data as Record<string, unknown>);

  let text = "";

  if (typeof obj.output_text === "string" && obj.output_text.trim()) {
    text = obj.output_text.trim();
  }

  if (!text && Array.isArray(obj.output)) {
    const chunks: string[] = [];
    for (const item of obj.output as Array<{ content?: Array<{ text?: string }> }>) {
      for (const part of item.content || []) {
        if (part.text) chunks.push(part.text);
      }
    }
    text = chunks.join("\n").trim();
  }

  if (!text) {
    const choices = obj.choices as Array<{ message?: { content?: string } }> | undefined;
    text = choices?.[0]?.message?.content?.trim() || "";
  }

  if (!text && provider === "anthropic") {
    const content = obj.content as Array<{ type?: string; text?: string }> | undefined;
    text = (content || [])
      .filter((part) => part.type === "text" && part.text)
      .map((part) => part.text)
      .join("\n")
      .trim();
  }

  if (!text && provider === "google") {
    text = googleCandidateText(data);
  }

  if (!text && provider === "workers-ai") {
    const result = obj.result as { response?: string } | string | undefined;
    if (typeof result === "string" && result.trim()) text = result.trim();
    else if (result && typeof result === "object" && typeof result.response === "string") {
      text = result.response.trim();
    }
  }

  if (!text) return "";
  if (provider === "google") text = salvageGatewayText(text);

  const sources = collectSearchSources(provider, data);
  if (sources.length === 0) return text;
  if (/https?:\/\//i.test(text) && sources.every((url) => text.includes(url))) return text;
  return `${text}\nSources: ${sources.join(" · ")}`;
}

/**
 * Post-parse checks for a Gateway payload. Exported so tests can cover Gemini
 * MAX_TOKENS / missing-grounding without a live fetch.
 */
export function finalizeAiGatewayResult(args: {
  provider: AiGatewayProvider;
  data: unknown;
  requireWebSearch?: boolean;
  requestBody?: unknown;
  gatewayRequestId?: string | null;
}): string {
  const gatewayRequestId = args.gatewayRequestId ?? null;
  const text = extractGatewayText(args.provider, args.data);
  if (!text) {
    throw new AiGatewayError(`AI Gateway ${args.provider} response missing text`, {
      softFail: true,
      gatewayRequestId,
    });
  }

  if (args.provider === "google" && googleFinishReason(args.data) === "MAX_TOKENS" && !isUsableShortlistText(text)) {
    throw new AiGatewayError(
      `AI Gateway google response truncated (MAX_TOKENS); retry with a higher output budget`,
      { softFail: true, gatewayRequestId },
    );
  }

  if (args.requireWebSearch && !responseUsedWebSearch(args.provider, args.data)) {
    const googleToolRequested = args.provider === "google" && googleSearchRequested(args.requestBody);
    if (googleToolRequested && isUsableShortlistText(text)) {
      console.warn(
        "[ai-gateway] google response missing groundingMetadata; accepting shortlist because google_search was requested",
      );
      return text;
    }
    throw new AiGatewayError(`AI Gateway ${args.provider} response did not use web search/grounding`, {
      softFail: true,
      gatewayRequestId,
    });
  }

  return text;
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
 * Cache note: D1 `engine_cache` is the product soft-fail cache. Free Retry may
 * read it for a failed engine; metered `processRun` always queries live and
 * writes on success. Gateway cache (`allow_24h`) is additive at the edge and
 * does not replace D1.
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
  await assertGatewayRunBudget(meta.run_id, meta.max_gateway_requests, args.db);

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

  const text = finalizeAiGatewayResult({
    provider: args.provider,
    data,
    requireWebSearch: args.requireWebSearch,
    requestBody: args.body,
    gatewayRequestId,
  });

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
