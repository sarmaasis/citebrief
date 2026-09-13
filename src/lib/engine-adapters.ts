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
  metadata?: {
    workspace_id?: string;
    brand_id?: string;
    run_id?: string;
    plan?: string;
    cache_policy?: AiGatewayCachePolicy;
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
  chatgpt: "OpenAI Responses + web",
  perplexity: "Perplexity Sonar",
  gemini: "Gemini + Search grounding",
  aio: "Google AI Overviews browser",
  claude: "Anthropic Claude",
  grok: "xAI Grok",
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
  perplexity: "Give a sourced shortlist for this purchase question. Cite URLs. Rank recommendations.",
  gemini: "Use Google Search grounding. Return who you would shortlist and which pages support that.",
  claude:
    "You are a buying advisor with web-aware knowledge. Return a ranked shortlist of products and any source URLs you can cite.",
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
  if (env.BROWSER) return true;
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
    case "perplexity":
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

async function queryViaGateway(
  input: EngineQueryInput,
  provider: "openai" | "perplexity" | "google" | "anthropic" | "xai",
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ text: string; gatewayRequestId: string | null }> {
  const result = await aiGatewayRequest({
    env: input.env,
    provider,
    path,
    body,
    headers: extraHeaders,
    metadata: buildMetadata(input),
  });
  if (result.stub) {
    throw new Error(result.reason);
  }
  return { text: result.text, gatewayRequestId: result.gatewayRequestId };
}

async function queryChatGPT(input: EngineQueryInput) {
  const buyer = input.buyer || "a buyer";
  return queryViaGateway(input, "openai", "/responses", {
    model: "gpt-4.1-mini",
    tools: [{ type: "web_search_preview" }],
    input: [
      { role: "developer", content: ENGINE_SYSTEM.chatgpt },
      { role: "user", content: USER_WRAPPER(buyer, input.prompt) },
    ],
  });
}

async function queryPerplexity(input: EngineQueryInput) {
  const buyer = input.buyer || "a buyer";
  return queryViaGateway(input, "perplexity", "/chat/completions", {
    model: "sonar",
    messages: [
      { role: "system", content: ENGINE_SYSTEM.perplexity },
      { role: "user", content: USER_WRAPPER(buyer, input.prompt) },
    ],
  });
}

async function queryGemini(input: EngineQueryInput) {
  const buyer = input.buyer || "a buyer";
  return queryViaGateway(
    input,
    "google",
    "/v1beta/models/gemini-2.0-flash:generateContent",
    {
      system_instruction: { parts: [{ text: ENGINE_SYSTEM.gemini }] },
      contents: [{ role: "user", parts: [{ text: USER_WRAPPER(buyer, input.prompt) }] }],
      tools: [{ google_search: {} }],
    },
  );
}

async function queryClaude(input: EngineQueryInput) {
  const buyer = input.buyer || "a buyer";
  return queryViaGateway(
    input,
    "anthropic",
    "/v1/messages",
    {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: ENGINE_SYSTEM.claude,
      messages: [{ role: "user", content: USER_WRAPPER(buyer, input.prompt) }],
    },
    { "anthropic-version": "2023-06-01" },
  );
}

async function queryGrok(input: EngineQueryInput) {
  const buyer = input.buyer || "a buyer";
  return queryViaGateway(input, "xai", "/v1/chat/completions", {
    model: "grok-3-mini",
    messages: [
      { role: "system", content: ENGINE_SYSTEM.grok },
      { role: "user", content: USER_WRAPPER(buyer, input.prompt) },
    ],
  });
}

/** AI Overviews: Cloudflare Browser Rendering only. Not AI Gateway. */
async function queryAio(input: EngineQueryInput, env: CloudflareEnv): Promise<string> {
  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(input.prompt)}&hl=en&gl=us`;
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
        body: JSON.stringify({ url: searchUrl, gotoOptions: { waitUntil: "networkidle0", timeout: 45000 } }),
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`AIO browser ${response.status}: ${detail.slice(0, 400)}`);
    }
    const data = (await response.json()) as { result?: string; success?: boolean };
    const html = data.result || "";
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000);
    if (!text) throw new Error("AIO browser returned empty content");
    return `Google AI Overviews / SERP extract for: ${input.prompt}\n${text}`;
  }

  throw new Error("AIO browser binding not configured");
}

async function liveAnswer(
  input: EngineQueryInput,
): Promise<{ text: string; gatewayRequestId: string | null }> {
  const env = input.env;
  switch (input.engine) {
    case "chatgpt":
      return queryChatGPT(input);
    case "perplexity":
      return queryPerplexity(input);
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
 * Real engine clients via Cloudflare AI Gateway (or Browser Rendering for AIO).
 * Falls back to deterministic stubs when gateway/browser config is missing or a live call fails.
 */
export async function queryEngine(input: EngineQueryInput): Promise<EngineQueryResult> {
  const started = Date.now();
  if (isEngineApiConfigured(input.engine, input.env)) {
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
      console.info(`[engine-adapters] ${input.engine} live failed; using stub`, error);
    }
  }
  return stubAnswer(input);
}
