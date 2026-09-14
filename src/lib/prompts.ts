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
/** Paid Starter / Agency default pack size (4+4+4+4+4). */
export const PROMPT_COUNT = 20;
export const PROMPT_YEAR = 2026;
export const PROMPT_WRITER_WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
export const PROMPT_WRITER_MAX_TOKENS = 700;

export type PromptCountOptions = { count?: number };

export function generatePromptsCta(count: number, existing: boolean): string {
  return existing ? `Regenerate ${count} prompts` : `Generate ${count} prompts`;
}

export function promptSetHint(count: number): string {
  if (count < PROMPT_COUNT) {
    return "One Discovery, Comparison, Job, Switch, and Incumbent question.";
  }
  if (count > PROMPT_COUNT) {
    return `Lock the mix at 4+4+4+4+4, then add up to ${count - PROMPT_COUNT} more.`;
  }
  return "Lock the mix at 4+4+4+4+4. Buyer questions only.";
}

export type PromptDraft = {
  text: string;
  mix: PromptMix;
  sortOrder: number;
};

const MIX_LABEL_PREFIX =
  /^(?:\*{1,2}|_{1,2})?\s*(discovery|comparison|job(?:\s*\/\s*constraint)?|switch(?:\s*\/\s*risk)?|incumbent(?:-seeded)?)\s*(?:\*{1,2}|_{1,2})?\s*:\s*/i;

function mixFromPrefixLabel(label: string): PromptMix | null {
  const key = label.toLowerCase().replace(/\s+/g, "");
  if (key.startsWith("discovery")) return "discovery";
  if (key.startsWith("comparison")) return "comparison";
  if (key.startsWith("job")) return "job";
  if (key.startsWith("switch")) return "switch";
  if (key.startsWith("incumbent")) return "incumbent";
  return null;
}

/** Remove writer leftovers like `**Discovery:**` — mix lives on the dropdown. */
export function stripMixLabelPrefix(text: string): string {
  return text.trim().replace(MIX_LABEL_PREFIX, "").replace(/^\*+\s*|\s*\*+$/g, "").trim();
}

export function normalizePromptDraft(draft: PromptDraft): PromptDraft {
  const match = draft.text.trim().match(MIX_LABEL_PREFIX);
  const inferred = match ? mixFromPrefixLabel(match[1] || "") : null;
  return {
    ...draft,
    mix: inferred ?? draft.mix,
    text: stripMixLabelPrefix(draft.text),
  };
}

export function normalizePromptDrafts(prompts: PromptDraft[]): PromptDraft[] {
  return prompts.map(normalizePromptDraft);
}

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

const VANITY_MESSAGE = "That reads like SEO, not a buyer. Try a comparison or job question.";

/** Brand-mention / login / GEO-score spam — not ordinary buyer questions. */
const VANITY_PATTERNS: RegExp[] = [
  /\bdoes\s+(chatgpt|gemini|perplexity|claude|grok|ai overviews?|an? (?:llm|ai|assistant))\s+mention\b/i,
  /\b(chatgpt|gemini|perplexity|claude|grok)\s+mention\b/i,
  /\b(geo|aeo)\s+(score|tool|ranking|visibility)\b/i,
  /\b(citation graph|ai visibility)\b/i,
  /\bseo (keyword|ranking|citations?)\b/i,
];

/** "What is the best X for Y" is a buyer question. "What is HubSpot?" is not. */
const BUYER_WHAT_IS =
  /\bwhat is the (best|top|right|cheapest|easiest|fastest|better|most)\b/i;

function isDefinitionalWhatIs(text: string): boolean {
  if (!/\bwhat is\b/i.test(text) || BUYER_WHAT_IS.test(text)) return false;
  if (/\b(for|vs\.?|versus|instead|compared|alternative)\b/i.test(text)) return false;
  const words = text.replace(/\?+$/, "").trim().split(/\s+/);
  return words.length <= 6;
}

export function isVanityPrompt(text: string, brand?: string, mix?: PromptMix): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return "Write a full buyer question.";
  }
  if (VANITY_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return VANITY_MESSAGE;
  }
  // Labeled Discovery/Job/etc. buyer questions are not vanity just because they say "best".
  if (!mix && isDefinitionalWhatIs(trimmed)) {
    return VANITY_MESSAGE;
  }
  if (brand) {
    const escaped = brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const brandVanity = new RegExp(
      `\\b(what is|who is)\\s+${escaped}\\b(?!\\s+(vs|versus|alternative|better|for))|\\b${escaped}\\s+login\\b|\\bdoes (chatgpt|anyone) mention\\s+${escaped}\\b`,
      "i",
    );
    if (brandVanity.test(trimmed) && !BUYER_WHAT_IS.test(trimmed)) {
      return VANITY_MESSAGE;
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
  const minCount = Math.min(PROMPT_COUNT, maxCount);
  if (prompts.length < minCount) {
    return { ok: false, error: `Keep at least ${minCount} buyer questions.` };
  }
  if (prompts.length > maxCount) {
    return { ok: false, error: `This plan allows ${maxCount} buyer questions.` };
  }
  if (minCount >= PROMPT_COUNT) {
    const locked = prompts
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .slice(0, PROMPT_COUNT);
    if (!mixIsLocked(locked)) {
      return { ok: false, error: "Lock the mix at 4 Discovery, 4 Comparison, 4 Job, 4 Switch, 4 Incumbent." };
    }
  } else {
    const counts = mixCounts(prompts);
    if (!MIXES.every((mix) => counts[mix] >= 1)) {
      return { ok: false, error: "Keep one Discovery, Comparison, Job, Switch, and Incumbent question." };
    }
  }
  for (const prompt of normalizePromptDrafts(prompts)) {
    const vanity = isVanityPrompt(prompt.text, brand, prompt.mix);
    if (!vanity) continue;
    // Trial packs: only empty text blocks Run. False SEO flags must not.
    if (maxCount < PROMPT_COUNT && vanity !== "Write a full buyer question.") {
      continue;
    }
    return { ok: false, error: vanity };
  }
  return { ok: true };
}

function slot(value: string | undefined, fallback: string) {
  const trimmed = cleanBusinessText(value);
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function articleFor(text: string) {
  return /^[aeiou]/i.test(text.trim()) ? "an" : "a";
}

const TEXT_FIXES: Array<[RegExp, string]> = [
  [/\bidie\b/gi, "indie"],
  [/\bmultipe\b/gi, "multiple"],
  [/\bmulitple\b/gi, "multiple"],
  [/\bcustome\b/gi, "customer"],
  [/\bcompititor(s?)\b/gi, "competitor$1"],
  [/\bfeatuers\b/gi, "features"],
];

function cleanBusinessText(value: string | undefined) {
  if (!value) return "";
  return TEXT_FIXES.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value)
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .trim();
}

function lowerFirst(value: string) {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function lowerPhrase(value: string) {
  return cleanBusinessText(value).toLowerCase();
}

function normalizeBuyerItem(value: string) {
  const cleaned = lowerPhrase(value).trim();
  if (/^agency$/i.test(cleaned)) return "agencies";
  return cleaned;
}

function humanList(value: string) {
  const items = value
    .split(",")
    .map(normalizeBuyerItem)
    .filter(Boolean);
  if (items.length <= 1) return items[0] || lowerFirst(value);
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function buyerContext(buyer: string) {
  return buyer.includes(",") ? humanList(buyer) : lowerFirst(buyer);
}

function constraintPhrase(value: string) {
  const trimmed = value.trim();
  if (/^no\s+/i.test(trimmed)) return `without ${trimmed.replace(/^no\s+/i, "")}`;
  if (/^without\s+/i.test(trimmed)) return trimmed;
  return `with ${trimmed}`;
}

function ensureQuestion(text: string) {
  const trimmed = text.trim().replace(/[.]+$/, "");
  return /[?!]$/.test(trimmed) ? trimmed : `${trimmed}?`;
}

export function generatePromptPack(input: PromptPackInput, options?: PromptCountOptions): PromptDraft[] {
  const brand = slot(input.brand, "the brand");
  const category = lowerPhrase(slot(input.category, "software"));
  const buyer = slot(input.buyer, "teams");
  const job = lowerPhrase(slot(input.job, "the work"));
  const vertical = input.vertical ? lowerPhrase(slot(input.vertical, buyer)) : "";
  const incumbent = slot(input.incumbent, "the incumbent");
  const constraint = constraintPhrase(lowerPhrase(slot(input.constraint, "fast setup")));
  const buyerLabel = buyerContext(buyer);
  const verticalLabel = vertical || buyerLabel;
  const comps = input.competitors.map((name) => cleanBusinessText(name)).filter(Boolean);
  const comp = comps[0] || "a rival";
  const compB = comps[1] || comps[0] || "another rival";
  const count = Math.max(1, options?.count ?? PROMPT_COUNT);

  const lines: Array<{ mix: PromptMix; text: string }> = [
    { mix: "discovery", text: `best ${category} platforms for ${buyerLabel} in ${PROMPT_YEAR}` },
    { mix: "discovery", text: `top ${category} vendors for ${verticalLabel} in ${PROMPT_YEAR}` },
    { mix: "discovery", text: `which ${category} tool should ${buyerLabel} use to ${job}` },
    { mix: "discovery", text: `best ${category} options ${constraint} in ${PROMPT_YEAR}` },
    { mix: "comparison", text: `${brand} vs ${comp} for ${buyerLabel}` },
    { mix: "comparison", text: `${comp} vs ${brand} for teams that need to ${job}` },
    { mix: "comparison", text: `${incumbent} alternatives for ${buyerLabel} in ${PROMPT_YEAR}` },
    { mix: "comparison", text: `best ${category} tools compared to ${incumbent}` },
    { mix: "job", text: `which ${category} tool can help ${buyerLabel} ${job}` },
    { mix: "job", text: `affordable ${category} software for ${buyerLabel} ${constraint}` },
    { mix: "job", text: `${category} tool for ${buyerLabel} that need to ${job}` },
    { mix: "job", text: `${category} platform with Slack and Google Drive support` },
    { mix: "switch", text: `is ${incumbent} still worth it for ${buyerLabel} in ${PROMPT_YEAR}` },
    { mix: "switch", text: `problems with ${incumbent} for ${buyerLabel}` },
    { mix: "switch", text: `when should ${buyerLabel} switch from ${incumbent}` },
    { mix: "switch", text: `${incumbent} vs modern ${category} alternatives in ${PROMPT_YEAR}` },
    { mix: "incumbent", text: `${incumbent} alternatives for teams that need to ${job}` },
    { mix: "incumbent", text: `who is better than ${incumbent} for ${verticalLabel}` },
    { mix: "incumbent", text: `${compB} vs ${incumbent} vs ${brand} for ${buyerLabel}` },
    { mix: "incumbent", text: `recommend ${articleFor(category)} ${category} tool instead of ${incumbent}` },
  ];

  if (count > PROMPT_COUNT) {
    lines.push(
      { mix: "discovery", text: `best ${category} shortlist for ${buyerLabel} this quarter` },
      { mix: "discovery", text: `which ${category} vendors are trusted by ${verticalLabel} teams` },
      { mix: "comparison", text: `${brand} vs ${compB} for ${job}` },
      { mix: "comparison", text: `${comp} vs ${incumbent} vs ${brand} for ${buyerLabel}` },
      { mix: "job", text: `${category} that can ${job} ${constraint}` },
      { mix: "job", text: `${category} for ${buyerLabel} who need faster onboarding` },
      { mix: "switch", text: `why do ${buyerLabel} leave ${incumbent}` },
      { mix: "switch", text: `switching from ${incumbent} to ${brand} for ${job}` },
      { mix: "incumbent", text: `replace ${incumbent} for ${buyerLabel}` },
      { mix: "incumbent", text: `${incumbent} replacement for ${job} ${constraint}` },
    );
  }

  const selected =
    count < PROMPT_COUNT
      ? MIXES.flatMap((mix) => lines.filter((line) => line.mix === mix).slice(0, 1)).slice(0, count)
      : lines.slice(0, count);

  return selected.map((line, index) =>
    normalizePromptDraft({
      text: ensureQuestion(line.text),
      mix: line.mix,
      sortOrder: index + 1,
    }),
  );
}

export async function generatePromptPackMaybeLlm(
  input: PromptPackInput,
  env?: CloudflareEnv,
  metadata?: {
    workspace_id?: string;
    brand_id?: string;
    plan?: string;
    count?: number;
  },
): Promise<{
  prompts: PromptDraft[];
  source: "template" | "llm";
}> {
  const count = Math.max(1, metadata?.count ?? PROMPT_COUNT);
  const { promptHash } = await import("@/lib/ai-gateway");
  if (!env?.AI) return { prompts: generatePromptPack(input, { count }), source: "template" };

  try {
    const mixLine =
      count < PROMPT_COUNT
        ? "Return exactly 5 numbered buyer questions, in this order: Discovery, Comparison, Job, Switch, Incumbent."
        : count > PROMPT_COUNT
          ? `Return exactly ${count} numbered buyer questions. First 20 follow 4 Discovery, 4 Comparison, 4 Job, 4 Switch, 4 Incumbent, then ${count - PROMPT_COUNT} more in those same mixes.`
          : "Return exactly 20 numbered buyer questions: 4 Discovery, 4 Comparison, 4 Job, 4 Switch, 4 Incumbent.";
    const category = lowerPhrase(slot(input.category, "software"));
    const buyer = buyerContext(slot(input.buyer, "teams"));
    const job = lowerPhrase(slot(input.job, "the job"));
    const brand = slot(input.brand, "the brand");
    const incumbent = slot(input.incumbent, "the incumbent");
    const competitors = input.competitors.map((name) => cleanBusinessText(name)).filter(Boolean).join(", ");
    const constraint = slot(input.constraint, "fast setup");
    const userContent = `You are a senior product marketer designing AI-search tracking prompts.

Create a ${count}-prompt set of high-intent buyer questions a real prospect would ask ChatGPT, Gemini, Grok, or AI Overviews while choosing vendors this week.

Category: ${category}
Buyer: ${buyer}
Job-to-be-done: ${job}
Brand: ${brand}
Incumbent: ${incumbent}
Competitors: ${competitors}
Must-have constraint: ${constraint}
Year: ${PROMPT_YEAR}

${mixLine}

Quality bar:
- Sound like polished vendor-selection questions, not keywords, blog titles, or SEO prompts.
- Fix obvious input typos silently.
- Ask for products, vendors, tools, alternatives, comparisons, switching advice, or shortlists.
- Do not ask broad education questions like "what are the key features".
- Do not use brand vanity prompts such as "does ChatGPT mention X".
- Use the brand only in credible comparison or replacement questions.
- Include the year on every question that uses "best" or "top".
- Keep each question under 140 characters.
- Do not prefix a question with Discovery, Comparison, Job, Switch, Incumbent, or markdown.
Return only the numbered list.`;

    const gatewayId = env.AI_GATEWAY_ID && env.AI_GATEWAY_ID !== "stub" ? env.AI_GATEWAY_ID : undefined;
    const raw = await env.AI.run(
      PROMPT_WRITER_WORKERS_AI_MODEL,
      {
        messages: [
          {
            role: "system",
            content:
              "You write concise, natural buyer questions for AI-search monitoring. Return only valid numbered lines.",
          },
          { role: "user", content: userContent },
        ],
        temperature: 0.35,
        max_tokens: PROMPT_WRITER_MAX_TOKENS,
      },
      gatewayId
        ? {
            gateway: {
              id: gatewayId,
              metadata: {
                workspace_id: metadata?.workspace_id,
                brand_id: metadata?.brand_id,
                engine: "prompt-writer-workers-ai",
                plan: metadata?.plan,
                prompt_hash: promptHash(userContent),
              },
            },
          }
        : undefined,
    );
    const text =
      typeof raw === "string"
        ? raw
        : typeof (raw as { response?: unknown })?.response === "string"
          ? (raw as { response: string }).response
          : "";
    const parsed = parseNumberedPrompts(text, count);
    if (parsed.length === count) {
      return { prompts: parsed, source: "llm" };
    }
  } catch {
    // Fall through to the template pack.
  }

  return { prompts: generatePromptPack(input, { count }), source: "template" };
}

function parseNumberedPrompts(content: string, count = PROMPT_COUNT): PromptDraft[] {
  const lines = content
    .split("\n")
    .map((line) => ensureQuestion(cleanBusinessText(line.replace(/^\s*\d+[.)]\s*/, ""))))
    .filter(Boolean);
  if (lines.length < count) {
    return [];
  }
  return generatePromptPack(
    {
      brand: "brand",
      category: "category",
      buyer: "buyer",
      incumbent: "incumbent",
      competitors: [],
    },
    { count },
  ).map((row, index) =>
    normalizePromptDraft({
      ...row,
      text: lines[index] ?? row.text,
    }),
  );
}
