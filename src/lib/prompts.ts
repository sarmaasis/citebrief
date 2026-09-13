export const MIXES = ["discovery", "comparison", "job", "switch", "incumbent"] as const;
export type PromptMix = (typeof MIXES)[number];

export const MIX_LABEL: Record<PromptMix, string> = {
  discovery: "Discovery",
  comparison: "Comparison",
  job: "Job",
  switch: "Switch",
  incumbent: "Incumbent",
};

export const MIX_TARGET = 4;
export const PROMPT_COUNT = 20;
export const PROMPT_YEAR = 2026;

export type PromptDraft = {
  text: string;
  mix: PromptMix;
  sortOrder: number;
};

export type PromptPackInput = {
  brand: string;
  category: string;
  buyer: string;
  job?: string;
  vertical?: string;
  incumbent: string;
  competitors: string[];
  constraint?: string;
};

const VANITY_PATTERNS: RegExp[] = [
  /\bdoes\s+(chatgpt|gemini|perplexity|claude|ai overviews?|an? (?:llm|ai|assistant))\s+mention\b/i,
  /\b(chatgpt|gemini|perplexity)\s+mention\b/i,
  /\bwhat is\s+.+\??$/i,
  /\blogin\b/i,
  /\bgeo\b|\baeo\b|\bllm\b|\bcitation graph\b/i,
  /\bai visibility\b/i,
  /\bseo (keyword|ranking|citations?)\b/i,
];

export function isVanityPrompt(text: string, brand?: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Write a full buyer question.";
  }
  if (VANITY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return 'That reads like SEO, not a buyer. Try a comparison or job question.';
  }
  if (brand) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const brandVanity = new RegExp(
      `\\b(what is|who is)\\s+${escaped}\\b|\\b${escaped}\\s+login\\b|\\bdoes (chatgpt|anyone) mention\\s+${escaped}\\b`,
      "i",
    );
    if (brandVanity.test(trimmed)) {
      return 'That reads like SEO, not a buyer. Try a comparison or job question.';
    }
  }
  return null;
}

export function mixCounts(prompts: { mix: string }[]): Record<PromptMix, number> {
  return MIXES.reduce(
    (acc, mix) => {
      acc[mix] = prompts.filter((prompt) => prompt.mix === mix).length;
      return acc;
    },
    { discovery: 0, comparison: 0, job: 0, switch: 0, incumbent: 0 },
  );
}

export function mixIsLocked(prompts: { mix: string }[]): boolean {
  const counts = mixCounts(prompts);
  return MIXES.every((mix) => counts[mix] === MIX_TARGET) && prompts.length === PROMPT_COUNT;
}

export function validatePromptSet(
  prompts: PromptDraft[],
  brand?: string,
  options?: { maxCount?: number },
): { ok: true } | { ok: false; error: string } {
  const maxCount = options?.maxCount ?? PROMPT_COUNT;
  if (prompts.length < PROMPT_COUNT) {
    return { ok: false, error: `Keep at least ${PROMPT_COUNT} buyer questions.` };
  }
  if (prompts.length > maxCount) {
    return { ok: false, error: `This plan allows ${maxCount} buyer questions.` };
  }
  const locked = prompts
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .slice(0, PROMPT_COUNT);
  if (!mixIsLocked(locked)) {
    return { ok: false, error: "Lock the mix at 4 Discovery, 4 Comparison, 4 Job, 4 Switch, 4 Incumbent." };
  }
  for (const prompt of prompts) {
    const vanity = isVanityPrompt(prompt.text, brand);
    if (vanity) {
      return { ok: false, error: vanity };
    }
  }
  return { ok: true };
}

function slot(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

export function generatePromptPack(input: PromptPackInput): PromptDraft[] {
  const brand = slot(input.brand, "the brand");
  const category = slot(input.category, "software");
  const buyer = slot(input.buyer, "teams");
  const job = slot(input.job, "the work");
  const vertical = slot(input.vertical, buyer);
  const incumbent = slot(input.incumbent, "the incumbent");
  const constraint = slot(input.constraint, "a short setup");
  const comps = input.competitors.map((name) => name.trim()).filter(Boolean);
  const comp = comps[0] || "a rival";
  const compB = comps[1] || comps[0] || "another rival";

  const lines: Array<{ mix: PromptMix; text: string }> = [
    { mix: "discovery", text: `best ${category} for ${buyer} ${PROMPT_YEAR}` },
    { mix: "discovery", text: `best ${category} for ${vertical} teams` },
    { mix: "discovery", text: `what ${category} should a ${buyer} use for ${job}` },
    { mix: "discovery", text: `${category} tools that actually work for ${constraint}` },
    { mix: "comparison", text: `${incumbent} alternatives ${PROMPT_YEAR}` },
    { mix: "comparison", text: `${brand} vs ${comp}` },
    { mix: "comparison", text: `${incumbent} vs ${brand} which is better for ${buyer}` },
    { mix: "comparison", text: `best ${category} compared to ${incumbent}` },
    { mix: "job", text: `${category} with ${constraint} for ${buyer}` },
    { mix: "job", text: `cheapest ${category} that can ${job}` },
    { mix: "job", text: `${category} for ${buyer} that does not need a 3-month implementation` },
    { mix: "job", text: `${category} that integrates with Slack and Google Drive` },
    { mix: "switch", text: `is ${incumbent} worth it for a ${buyer}` },
    { mix: "switch", text: `problems with ${incumbent}` },
    { mix: "switch", text: `when to switch from ${incumbent}` },
    { mix: "switch", text: `${incumbent} vs cheaper alternatives ${PROMPT_YEAR}` },
    { mix: "incumbent", text: `${incumbent} alternatives for ${job}` },
    { mix: "incumbent", text: `who is better than ${incumbent} for ${vertical}` },
    { mix: "incumbent", text: `${compB} vs ${incumbent} vs ${brand}` },
    { mix: "incumbent", text: `recommend a ${category} instead of ${incumbent}` },
  ];

  return lines.map((line, index) => ({
    text: line.text,
    mix: line.mix,
    sortOrder: index + 1,
  }));
}

export async function generatePromptPackMaybeLlm(
  input: PromptPackInput,
  env?: CloudflareEnv,
  metadata?: {
    workspace_id?: string;
    brand_id?: string;
    plan?: string;
  },
): Promise<{
  prompts: PromptDraft[];
  source: "template" | "llm";
}> {
  const { aiGatewayRequest, isAiGatewayConfigured, promptHash } = await import("@/lib/ai-gateway");
  if (!isAiGatewayConfigured(env)) {
    return { prompts: generatePromptPack(input), source: "template" };
  }

  try {
    const userContent = `You build a 20-prompt tracking set for AI-search buyer questions.

Category: ${input.category}
Buyer: ${input.buyer}
Job: ${input.job ?? ""}
Brand: ${input.brand}
Incumbent: ${input.incumbent}
Competitors: ${input.competitors.join(", ")}
Must-have constraint: ${input.constraint ?? ""}
Year: ${PROMPT_YEAR}

Return exactly 20 prompts, numbered, using the 4+4+4+4+4 mix:
Discovery, Comparison, Job/constraint, Switch/risk, Incumbent-seeded.

No brand vanity ("does ChatGPT mention X").
No keywords. Full questions a person would type.
Include the year on every "best" prompt.`;

    const result = await aiGatewayRequest({
      env,
      provider: "openai",
      path: "/chat/completions",
      body: {
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [{ role: "user", content: userContent }],
      },
      metadata: {
        workspace_id: metadata?.workspace_id,
        brand_id: metadata?.brand_id,
        engine: "prompt-writer",
        plan: metadata?.plan,
        prompt_hash: promptHash(userContent),
        cache_policy: "fresh",
      },
    });
    if (result.stub) {
      return { prompts: generatePromptPack(input), source: "template" };
    }
    const parsed = parseNumberedPrompts(result.text);
    if (parsed.length === PROMPT_COUNT) {
      return { prompts: parsed, source: "llm" };
    }
  } catch {
    // Fall through to the template pack.
  }

  return { prompts: generatePromptPack(input), source: "template" };
}

function parseNumberedPrompts(content: string): PromptDraft[] {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length < PROMPT_COUNT) {
    return [];
  }
  return generatePromptPack({
    brand: "brand",
    category: "category",
    buyer: "buyer",
    incumbent: "incumbent",
    competitors: [],
  }).map((row, index) => ({
    ...row,
    text: lines[index] ?? row.text,
  }));
}
