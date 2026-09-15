import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AiGatewayError,
  extractGatewayText,
  finalizeAiGatewayResult,
  googleSearchRequested,
  isUsableShortlistText,
  responseUsedWebSearch,
} from "@/lib/ai-gateway";
import {
  CLAUDE_MAX_TOKENS,
  ENGINE_MODELS,
  GEMINI_MAX_OUTPUT_TOKENS,
  SHORTLIST_MAX_OUTPUT_TOKENS,
  buildEngineSearchRequest,
} from "@/lib/engine-adapters";

const chatgpt = buildEngineSearchRequest("chatgpt", "agencies", "best crm for agencies");
assert.equal(chatgpt.provider, "openai");
assert.equal(chatgpt.path, "/responses");
assert.equal(chatgpt.body.model, ENGINE_MODELS.chatgpt);
assert.equal(chatgpt.body.model, "gpt-5.4-mini");
assert.equal(chatgpt.body.tool_choice, "required");
assert.equal(chatgpt.body.max_tool_calls, 1);
assert.equal(chatgpt.body.store, false);
assert.equal(chatgpt.body.max_output_tokens, SHORTLIST_MAX_OUTPUT_TOKENS);
assert.deepEqual(chatgpt.body.tools, [{ type: "web_search" }]);
assert.doesNotMatch(JSON.stringify(chatgpt.body), /web_search_preview/);

const gemini = buildEngineSearchRequest("gemini", "agencies", "best crm for agencies");
assert.equal(gemini.provider, "google");
assert.match(gemini.path, /gemini-2\.5-flash:generateContent/);
assert.deepEqual(gemini.body.tools, [{ google_search: {} }]);
assert.ok(googleSearchRequested(gemini.body));
assert.ok(GEMINI_MAX_OUTPUT_TOKENS >= 4096);
assert.equal(
  (gemini.body.generationConfig as { maxOutputTokens?: number }).maxOutputTokens,
  GEMINI_MAX_OUTPUT_TOKENS,
);
assert.notEqual(
  (gemini.body.generationConfig as { maxOutputTokens?: number }).maxOutputTokens,
  SHORTLIST_MAX_OUTPUT_TOKENS,
);
assert.deepEqual((gemini.body.generationConfig as { thinkingConfig?: unknown }).thinkingConfig, {
  thinkingBudget: 0,
});

const claude = buildEngineSearchRequest("claude", "agencies", "best crm for agencies");
assert.equal(claude.provider, "anthropic");
assert.equal(claude.body.model, "claude-sonnet-5");
assert.equal(claude.body.max_tokens, CLAUDE_MAX_TOKENS);
assert.ok(CLAUDE_MAX_TOKENS <= 1024);
assert.deepEqual(claude.body.tools, [{ type: "web_search_20250305", name: "web_search", max_uses: 1 }]);
assert.equal(claude.body.tool_choice, undefined);

const grok = buildEngineSearchRequest("grok", "agencies", "best crm for agencies");
assert.equal(grok.provider, "xai");
assert.equal(grok.path, "/v1/chat/completions");
assert.equal(grok.body.model, "grok-4.3");
assert.notEqual(grok.body.model, "grok-4.6");
assert.equal(grok.body.max_tokens, SHORTLIST_MAX_OUTPUT_TOKENS);
assert.equal(grok.body.reasoning_effort, "none");
assert.equal("search_parameters" in grok.body, false);
assert.equal("tools" in grok.body, false);

const adapterSrc = readFileSync(join(process.cwd(), "src/lib/engine-adapters.ts"), "utf8");
const writerSrc = readFileSync(join(process.cwd(), "src/lib/prompts.ts"), "utf8");
for (const stale of ["gpt-4.1-mini", "gpt-4o-mini", "gemini-2.0-flash", "claude-sonnet-4", "grok-4.6"]) {
  assert.doesNotMatch(adapterSrc, new RegExp(stale.replace(/\./g, "\\.")));
  assert.doesNotMatch(writerSrc, new RegExp(stale.replace(/\./g, "\\.")));
}

assert.equal(
  responseUsedWebSearch("openai", {
    output_text: "Shortlist: HubSpot.",
    output: [{ type: "web_search_call", status: "completed" }],
  }),
  true,
);
assert.equal(
  responseUsedWebSearch("openai", {
    output_text: "Shortlist: HubSpot.",
    output: [{ type: "message", content: [{ text: "Shortlist: HubSpot." }] }],
  }),
  false,
);
assert.equal(
  responseUsedWebSearch("google", {
    candidates: [
      {
        content: { parts: [{ text: "Shortlist: HubSpot." }] },
        groundingMetadata: { webSearchQueries: ["best crm for agencies"] },
      },
    ],
  }),
  true,
);
assert.equal(
  responseUsedWebSearch("google", {
    candidates: [{ content: { parts: [{ text: "Shortlist: HubSpot." }] } }],
  }),
  false,
);
assert.equal(
  responseUsedWebSearch("anthropic", {
    content: [
      { type: "server_tool_use", name: "web_search" },
      { type: "text", text: "Shortlist: HubSpot." },
    ],
  }),
  true,
);
assert.equal(
  responseUsedWebSearch("xai", {
    output_text: "Shortlist: HubSpot.",
    citations: ["https://example.com/hubspot"],
  }),
  true,
);

const grounded = extractGatewayText("google", {
  candidates: [
    {
      content: { parts: [{ text: "Shortlist: HubSpot." }] },
      groundingMetadata: {
        groundingChunks: [{ web: { uri: "https://www.g2.com/categories/crm" } }],
      },
    },
  ],
});
assert.match(grounded, /Shortlist: HubSpot/);
assert.match(grounded, /https:\/\/www\.g2\.com\/categories\/crm/);

assert.equal(
  responseUsedWebSearch("google", {
    result: {
      candidates: [{ grounding_metadata: { web_search_queries: ["best crm"] } }],
    },
  }),
  true,
);

const geminiMaxTokensFixture = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: "ranked by scalability, multi",
            thoughtSignature: "Ckdhd2Vzb21lLWxvbmcgdGhvdWdodC1zaWduYXR1cmUtdGhhdC1pcy1ub3QtdGV4dA",
          },
        ],
        role: "model",
      },
      finishReason: "MAX_TOKENS",
    },
  ],
  usageMetadata: {
    thoughtsTokenCount: 1260,
    promptTokenCount: 80,
    candidatesTokenCount: 700,
    totalTokenCount: 2040,
  },
  modelVersion: "gemini-2.5-flash",
};

assert.equal(responseUsedWebSearch("google", geminiMaxTokensFixture), false);
assert.match(extractGatewayText("google", geminiMaxTokensFixture), /ranked by scalability, multi/);
assert.equal(isUsableShortlistText("ranked by scalability, multi"), false);

assert.throws(
  () =>
    finalizeAiGatewayResult({
      provider: "google",
      data: geminiMaxTokensFixture,
      requireWebSearch: true,
      requestBody: gemini.body,
    }),
  (error: unknown) =>
    error instanceof AiGatewayError &&
    /MAX_TOKENS/.test(error.message) &&
    !/web search\/grounding/.test(error.message),
);

const geminiUngroundedShortlist = {
  candidates: [
    {
      content: {
        parts: [
          {
            text: "Shortlist: HubSpot, Salesforce, Pipedrive. HubSpot leads for agencies.",
          },
        ],
      },
      finishReason: "STOP",
    },
  ],
};
assert.equal(responseUsedWebSearch("google", geminiUngroundedShortlist), false);
assert.match(
  finalizeAiGatewayResult({
    provider: "google",
    data: geminiUngroundedShortlist,
    requireWebSearch: true,
    requestBody: { tools: [{ google_search: {} }] },
  }),
  /HubSpot/,
);

assert.throws(
  () =>
    finalizeAiGatewayResult({
      provider: "openai",
      data: {
        output_text: "Shortlist: HubSpot, Salesforce, Pipedrive.",
        output: [{ type: "message", content: [{ text: "Shortlist: HubSpot, Salesforce, Pipedrive." }] }],
      },
      requireWebSearch: true,
    }),
  (error: unknown) => error instanceof AiGatewayError && /web search\/grounding/.test(error.message),
);

console.log("engine-search.test.ts ok");
