import type { EngineId } from "@/lib/engines";
import { isStubSecret } from "@/lib/billing";

export type EngineQueryInput = {
  engine: EngineId;
  prompt: string;
  brand: string;
  competitors: string[];
  buyer?: string | null;
  env?: CloudflareEnv;
};

export type EngineQueryResult = {
  rawAnswer: string;
  stubbed: boolean;
  latencyMs: number;
};

const SYSTEM_HINTS: Record<EngineId, string> = {
  chatgpt: "OpenAI Responses + web",
  perplexity: "Perplexity Sonar",
  gemini: "Gemini + Search grounding",
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
  perplexity: "Give a sourced shortlist for this purchase question. Cite URLs. Rank recommendations.",
  gemini: "Use Google Search grounding. Return who you would shortlist and which pages support that.",
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

function openaiKey(env?: CloudflareEnv) {
  return env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
}

function perplexityKey(env?: CloudflareEnv) {
  return env?.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
}

function geminiKey(env?: CloudflareEnv) {
  return env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
}

function aioConfigured(env?: CloudflareEnv) {
  if (!env) return false;
  if (env.BROWSER) return true;
  const account = env.CF_ACCOUNT_ID || process.env.CF_ACCOUNT_ID;
  const token = env.CF_API_TOKEN || process.env.CF_API_TOKEN;
  return Boolean(account && token && !isStubSecret(account) && !isStubSecret(token));
}

export function isEngineApiConfigured(engine: EngineId, env?: CloudflareEnv): boolean {
  switch (engine) {
    case "chatgpt":
      return !isStubSecret(openaiKey(env));
    case "perplexity":
      return !isStubSecret(perplexityKey(env));
    case "gemini":
      return !isStubSecret(geminiKey(env));
    case "aio":
      return aioConfigured(env);
    default:
      return false;
  }
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
  };
}

async function queryChatGPT(input: EngineQueryInput, key: string): Promise<string> {
  const buyer = input.buyer || "a buyer";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      tools: [{ type: "web_search_preview" }],
      input: [
        { role: "developer", content: ENGINE_SYSTEM.chatgpt },
        { role: "user", content: USER_WRAPPER(buyer, input.prompt) },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 400)}`);
  }
  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  };
  if (data.output_text?.trim()) return data.output_text.trim();
  const chunks: string[] = [];
  for (const item of data.output || []) {
    for (const part of item.content || []) {
      if (part.text) chunks.push(part.text);
    }
  }
  const text = chunks.join("\n").trim();
  if (!text) throw new Error("OpenAI response missing text");
  return text;
}

async function queryPerplexity(input: EngineQueryInput, key: string): Promise<string> {
  const buyer = input.buyer || "a buyer";
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      messages: [
        { role: "system", content: ENGINE_SYSTEM.perplexity },
        { role: "user", content: USER_WRAPPER(buyer, input.prompt) },
      ],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Perplexity ${response.status}: ${detail.slice(0, 400)}`);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Perplexity response missing text");
  return text;
}

async function queryGemini(input: EngineQueryInput, key: string): Promise<string> {
  const buyer = input.buyer || "a buyer";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: ENGINE_SYSTEM.gemini }] },
      contents: [{ role: "user", parts: [{ text: USER_WRAPPER(buyer, input.prompt) }] }],
      tools: [{ google_search: {} }],
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini ${response.status}: ${detail.slice(0, 400)}`);
  }
  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n").trim();
  if (!text) throw new Error("Gemini response missing text");
  return text;
}

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

async function liveAnswer(input: EngineQueryInput): Promise<string> {
  const env = input.env;
  switch (input.engine) {
    case "chatgpt": {
      const key = openaiKey(env);
      if (!key || isStubSecret(key)) throw new Error("OPENAI_API_KEY missing");
      return queryChatGPT(input, key);
    }
    case "perplexity": {
      const key = perplexityKey(env);
      if (!key || isStubSecret(key)) throw new Error("PERPLEXITY_API_KEY missing");
      return queryPerplexity(input, key);
    }
    case "gemini": {
      const key = geminiKey(env);
      if (!key || isStubSecret(key)) throw new Error("GEMINI_API_KEY missing");
      return queryGemini(input, key);
    }
    case "aio": {
      if (!env) throw new Error("env required for AIO");
      return queryAio(input, env);
    }
    default:
      throw new Error(`Unknown engine ${(input as EngineQueryInput).engine}`);
  }
}

/**
 * Real engine clients when API keys / browser bindings are present.
 * Falls back to deterministic stubs when unset or when a live call fails.
 */
export async function queryEngine(input: EngineQueryInput): Promise<EngineQueryResult> {
  const started = Date.now();
  if (isEngineApiConfigured(input.engine, input.env)) {
    try {
      const rawAnswer = await liveAnswer(input);
      return {
        rawAnswer,
        stubbed: false,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      console.info(`[engine-adapters] ${input.engine} live failed; using stub`, error);
    }
  }
  return stubAnswer(input);
}
