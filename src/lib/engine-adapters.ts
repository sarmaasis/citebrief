import type { EngineId } from "@/lib/engines";
import { isStubSecret } from "@/lib/billing";
import {
  aiGatewayRequest,
  isAiGatewayConfigured,
  promptHash,
  type AiGatewayCachePolicy,
  type AiGatewayMetadata,
} from "@/lib/ai-gateway";

export type EngineQueryInput = {
  engine: EngineId;
  prompt: string;
  brand: string;
  competitors: string[];
  buyer?: string | null;
  env?: CloudflareEnv;
  db?: import("@/db").Database;
  metadata?: {
    workspace_id?: string;
    brand_id?: string;
    run_id?: string;
    plan?: string;
    cache_policy?: AiGatewayCachePolicy;
    max_gateway_requests?: number;
  };
};

export type EngineQueryResult = {
  rawAnswer: string;
  stubbed: boolean;
  latencyMs: number;
  gatewayRequestId?: string | null;
  confidence?: "low" | "medium" | "high" | null;
};

const SYSTEM_HINTS: Record<EngineId, string> = {
  chatgpt: "OpenAI Responses + web search",
  gemini: "Gemini + Search grounding",
  claude: "Anthropic Claude + web search",
  grok: "xAI Grok",
  aio: "Google AI Overviews browser",
};

const USER_WRAPPER = (buyer: string, prompt: string) =>
  [
    `Answer as if a ${buyer} asked this while choosing a vendor this week.`,
    `Question: ${prompt}`,
    "",
    "Rules:",
    "- Name specific products. Do not give generic advice.",
    "- If you recommend a shortlist, order it.",
    "- Mention pricing only if you are confident.",
    "- If you cite sources, keep the URLs.",
    "- Do not ask a follow-up question.",
  ].join("\n");

const ENGINE_SYSTEM: Record<Exclude<EngineId, "aio">, string> = {
  chatgpt:
    "You are a buying advisor. Use web search. Prefer current vendor pages, G2, and recent roundups. Return the shortlist and any URLs you used.",
  gemini:
    "Use Google Search. Return a short ranked shortlist of at most five products and the source URLs. Under 120 words. No long plan.",
  claude:
    "You are a buying advisor. Use web search once. Return a ranked shortlist of at most five products and the source URLs. Under 180 words. No long quotes from pages.",
  grok: "You are a buying advisor. Return a ranked shortlist of products with brief reasons and URLs when known.",
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(items: T[], seed: number, salt: number): T {
  return items[(seed + salt) % items.length]!;
}

function aioConfigured(env?: CloudflareEnv) {
  if (!env) return false;
  // Must match queryAio: binding only counts if Quick Actions exist.
  if (typeof env.BROWSER?.quickAction === "function") return true;
  const account = env.CF_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const token = env.CF_API_TOKEN || process.env.CF_API_TOKEN;
  return Boolean(account && token && !isStubSecret(account) && !isStubSecret(token));
}

/**
 * LLM engines need AI Gateway. AIO uses Browser Rendering only.
 */
export function isEngineApiConfigured(engine: EngineId, env?: CloudflareEnv): boolean {
  switch (engine) {
    case "chatgpt":
    case "gemini":
    case "claude":
    case "grok":
      return isAiGatewayConfigured(env);
    case "aio":
      return aioConfigured(env);
    default:
      return false;
  }
}

function buildMetadata(input: EngineQueryInput): AiGatewayMetadata {
  return {
    workspace_id: input.metadata?.workspace_id,
    brand_id: input.metadata?.brand_id,
    run_id: input.metadata?.run_id,
    engine: input.engine,
    plan: input.metadata?.plan,
    prompt_hash: promptHash(input.prompt),
    cache_policy: input.metadata?.cache_policy || "fresh",
    max_gateway_requests: input.metadata?.max_gateway_requests,
  };
}

async function stubAnswer(input: EngineQueryInput): Promise<EngineQueryResult> {
  const started = Date.now();
  const seed = hashSeed(`${input.engine}|${input.prompt}|${input.brand}`);
  const rivals = input.competitors.length > 0 ? input.competitors : ["ClickUp", "Asana", "Monday.com"];
  const winnerPool = [input.brand, ...rivals];
  const whoWon = pick(winnerPool, seed, 3);
  const named = whoWon === input.brand || seed % 5 !== 0;
  const shortlist = named
    ? [whoWon, ...rivals.filter((name) => name !== whoWon)].slice(0, 3)
    : rivals.slice(0, 3);

  await new Promise((resolve) => setTimeout(resolve, 15 + (seed % 40)));

  const buyer = input.buyer || "a buyer";
  const urls = named
    ? [`https://example.com/${input.brand.toLowerCase().replace(/\s+/g, "-")}`, "https://g2.com/categories/example"]
    : [`https://example.com/${whoWon.toLowerCase().replace(/\s+/g, "-")}`];

  const rawAnswer = [
    `${SYSTEM_HINTS[input.engine]} (stub) answer for ${buyer}.`,
    `Question: ${input.prompt}`,
    `Shortlist: ${shortlist.join(", ")}.`,
    named
      ? `${input.brand} appears in the shortlist${whoWon === input.brand ? " and leads" : ""}.`
      : `${input.brand} is not named. ${whoWon} leads this shortlist.`,
    `Sources: ${urls.join(" · ")}`,
  ].join(" ");

  return {
    rawAnswer,
    stubbed: true,
    latencyMs: Date.now() - started,
    gatewayRequestId: null,
    confidence: "low",
  };
}

export const ENGINE_MODELS = {
  chatgpt: "gpt-5.4-mini",
  gemini: "gemini-2.5-flash",
  claude: "claude-sonnet-5",
  /** Chat-completions + live search. Newer Responses model IDs returned 0 tokens on this Gateway. */
  grok: "grok-4.3",
} as const;

export const CLAUDE_MAX_TOKENS = 800;
export const SHORTLIST_MAX_OUTPUT_TOKENS = 700;
/** Gemini 3 thinking counts against maxOutputTokens; 700 truncates the shortlist. */
export const GEMINI_MAX_OUTPUT_TOKENS = 4096;

export type EngineSearchRequest = {
  provider: "openai" | "google" | "anthropic" | "xai";
  path: string;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
};

/**
 * Provider request each core LLM engine sends through AI Gateway.
 * Every body includes the provider's native web-search / grounding tool.
 */
export function buildEngineSearchRequest(
  engine: Exclude<EngineId, "aio">,
  buyer: string,
  prompt: string,
): EngineSearchRequest {
  const user = USER_WRAPPER(buyer, prompt);
  switch (engine) {
    case "chatgpt":
      return {
        provider: "openai",
        path: "/responses",
        body: {
          model: ENGINE_MODELS.chatgpt,
          tools: [{ type: "web_search" }],
          tool_choice: "required",
          max_tool_calls: 1,
          max_output_tokens: SHORTLIST_MAX_OUTPUT_TOKENS,
          store: false,
          input: [
            { role: "developer", content: ENGINE_SYSTEM.chatgpt },
            { role: "user", content: user },
          ],
        },
      };
    case "gemini":
      return {
        provider: "google",
        path: `/v1beta/models/${ENGINE_MODELS.gemini}:generateContent`,
        body: {
          system_instruction: { parts: [{ text: ENGINE_SYSTEM.gemini }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
            thinkingConfig: { thinkingBudget: 0 },
          },
        },
      };
    case "claude":
      return {
        provider: "anthropic",
        path: "/v1/messages",
        body: {
          model: ENGINE_MODELS.claude,
          max_tokens: CLAUDE_MAX_TOKENS,
          system: ENGINE_SYSTEM.claude,
          messages: [{ role: "user", content: user }],
          tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }],
        },
        headers: { "anthropic-version": "2023-06-01" },
      };
    case "grok":
      return {
        provider: "xai",
        path: "/v1/chat/completions",
        body: {
          model: ENGINE_MODELS.grok,
          max_tokens: SHORTLIST_MAX_OUTPUT_TOKENS,
          reasoning_effort: "none",
          messages: [
            { role: "system", content: ENGINE_SYSTEM.grok },
            { role: "user", content: user },
          ],
        },
      };
    default:
      throw new Error(`Unknown LLM engine ${engine as string}`);
  }
}

async function queryViaGateway(
  input: EngineQueryInput,
  request: EngineSearchRequest,
  opts: { requireWebSearch?: boolean } = { requireWebSearch: true },
): Promise<{ text: string; gatewayRequestId: string | null }> {
  const result = await aiGatewayRequest({
    env: input.env,
    db: input.db,
    provider: request.provider,
    path: request.path,
    body: request.body,
    headers: request.headers,
    metadata: buildMetadata(input),
    requireWebSearch: opts.requireWebSearch ?? true,
  });
  if (result.stub) {
    throw new Error(result.reason);
  }
  return { text: result.text, gatewayRequestId: result.gatewayRequestId };
}

async function queryChatGPT(input: EngineQueryInput) {
  return queryViaGateway(input, buildEngineSearchRequest("chatgpt", input.buyer || "a buyer", input.prompt));
}

async function queryGemini(input: EngineQueryInput) {
  return queryViaGateway(input, buildEngineSearchRequest("gemini", input.buyer || "a buyer", input.prompt));
}

async function queryClaude(input: EngineQueryInput) {
  return queryViaGateway(input, buildEngineSearchRequest("claude", input.buyer || "a buyer", input.prompt));
}

async function queryGrok(input: EngineQueryInput) {
  return queryViaGateway(input, buildEngineSearchRequest("grok", input.buyer || "a buyer", input.prompt), {
    requireWebSearch: false,
  });
}

function htmlToAioText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

async function aioHtmlFromResponse(response: Response, label: string): Promise<string> {
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`${label} ${response.status}: ${detail.slice(0, 400)}`);
  }
  const data = (await response.json()) as { result?: string; success?: boolean };
  if (data.success === false) {
    throw new Error(`${label} unsuccessful response`);
  }
  const text = htmlToAioText(data.result || "");
  if (!text) throw new Error(`${label} returned empty content`);
  return text;
}

/**
 * AI Overviews: Browser Run binding first (prod Worker has `BROWSER`), REST token fallback.
 * Not AI Gateway. aioConfigured() must match this path or live runs throw.
 */
async function queryAio(input: EngineQueryInput, env: CloudflareEnv): Promise<string> {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(input.prompt)}&hl=en&gl=us`;
  const gotoOptions = { waitUntil: "domcontentloaded", timeout: 15000 };

  if (env.BROWSER?.quickAction) {
    const response = await env.BROWSER.quickAction("content", { url: searchUrl, gotoOptions });
    const text = await aioHtmlFromResponse(response, "AIO browser binding");
    return `Google AI Overviews / SERP extract for: ${input.prompt}\n${text}`;
  }

  const account = env.CF_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const token = env.CF_API_TOKEN || process.env.CF_API_TOKEN;
  if (account && token && !isStubSecret(account) && !isStubSecret(token)) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/browser-rendering/content`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: searchUrl, gotoOptions }),
      },
    );
    const text = await aioHtmlFromResponse(response, "AIO browser REST");
    return `Google AI Overviews / SERP extract for: ${input.prompt}\n${text}`;
  }

  throw new Error("AIO not configured (need BROWSER binding or CF_ACCOUNT_ID + CF_API_TOKEN)");
}

async function liveAnswer(
  input: EngineQueryInput,
): Promise<{ text: string; gatewayRequestId: string | null }> {
  const env = input.env;
  switch (input.engine) {
    case "chatgpt":
      return queryChatGPT(input);
    case "gemini":
      return queryGemini(input);
    case "claude":
      return queryClaude(input);
    case "grok":
      return queryGrok(input);
    case "aio": {
      if (!env) throw new Error("env required for AIO");
      const text = await queryAio(input, env);
      return { text, gatewayRequestId: null };
    }
    default:
      throw new Error(`Unknown engine ${(input as EngineQueryInput).engine}`);
  }
}

/**
 * Stub answers are only for engines that are not live-configured.
 * A configured live provider that errors must fail the engine (3/4 soft-fail),
 * never return fake-looking successful stub output to paid clients.
 */
export function usesDeterministicStub(engine: EngineId, env?: CloudflareEnv): boolean {
  return !isEngineApiConfigured(engine, env);
}

/**
 * Real engine clients via Cloudflare AI Gateway (or Browser Rendering for AIO).
 * Unconfigured engines use deterministic stubs. Configured live failures throw
 * so processRun can mark that engine failed.
 */
export async function queryEngine(input: EngineQueryInput): Promise<EngineQueryResult> {
  const started = Date.now();
  if (!usesDeterministicStub(input.engine, input.env)) {
    try {
      const live = await liveAnswer(input);
      return {
        rawAnswer: live.text,
        stubbed: false,
        latencyMs: Date.now() - started,
        gatewayRequestId: live.gatewayRequestId,
        confidence: input.engine === "aio" ? "medium" : "high",
      };
    } catch (error) {
      console.info(`[engine-adapters] ${input.engine} live failed`, error);
      throw error instanceof Error ? error : new Error(String(error));
    }
  }
  return stubAnswer(input);
}
