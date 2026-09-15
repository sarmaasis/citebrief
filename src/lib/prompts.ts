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
/** Cheap Workers AI instruct model for numbered buyer-prompt packs. Non-fast 3.1-8b was deprecated 2026-05-30. */
export const PROMPT_WRITER_WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
export const PROMPT_WRITER_MAX_TOKENS = 700;

export type PromptCountOptions = { count?: number };

export function generatePromptsCta(count: number, existing: boolean, currentCount?: number): string {
  if (existing && currentCount != null && currentCount > 0 && currentCount < count) {
    return `Add ${count - currentCount} prompts`;
  }
  return existing ? "Replace all prompts" : `Generate ${count} prompts`;
}

/** Confirm copy when hard-replacing a full prompt set (archives old rows; keeps report scores). */
export const REPLACE_PROMPTS_CONFIRM =
  "This archives current prompts. Past report scores stay; the Prompts table will show the new set.";

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
  /** Stable DB id when editing an existing prompt — preserved across save. */
  id?: string;
  text: string;
  mix: PromptMix;
  intent?: PromptMix;
  branded?: boolean;
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
    id: draft.id,
    mix: inferred ?? draft.mix,
    intent: inferred ?? draft.intent ?? draft.mix,
    branded: draft.branded ?? isBrandedPrompt(stripMixLabelPrefix(draft.text), undefined),
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
  market?: string;
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function isBrandedPrompt(text: string, brand?: string) {
  const names = [brand].filter((value): value is string => Boolean(value?.trim()));
  return names.some((name) => new RegExp(`\\b${escapeRegExp(name)}\\b`, "i").test(text));
}

/** Page-1 score uses comparison / job / switch only. Discovery is shown; branded is appendix. */
export function isScoreIntent(intent: string | null | undefined): boolean {
  return intent === "comparison" || intent === "job" || intent === "switch";
}

export function brandedShare(prompts: { branded?: boolean; text?: string }[], brand?: string): number {
  if (!prompts.length) return 0;
  const branded = prompts.filter((p) => p.branded || (p.text ? isBrandedPrompt(p.text, brand) : false)).length;
  return branded / prompts.length;
}

export function brandedShareWarns(prompts: { branded?: boolean; text?: string }[], brand?: string): boolean {
  return brandedShare(prompts, brand) > 0.2;
}

export function promptIntent(text: string, fallback: PromptMix): PromptMix {
  return inferMixFromText(text) ?? fallback;
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
    // Trial packs: empty text still blocks. Soften only definitional "what is X"
    // so onboarding edits are not blocked by aggressive SEO false positives —
    // brand-login / GEO / "does ChatGPT mention" still fail.
    if (
      maxCount < PROMPT_COUNT &&
      vanity === VANITY_MESSAGE &&
      isDefinitionalWhatIs(prompt.text.trim()) &&
      !VANITY_PATTERNS.some((pattern) => pattern.test(prompt.text.trim()))
    ) {
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

/**
 * Keep existing drafts and append pack lines until `targetCap`.
 * Prefer underrepresented mixes; skip duplicate text. Idempotent at/above cap.
 * Empty sets are left alone (caller generates a full pack on first setup).
 */
export function topUpPromptDrafts(
  existing: PromptDraft[],
  targetCap: number,
  input: PromptPackInput,
): PromptDraft[] {
  const cap = Math.max(1, targetCap);
  if (existing.length === 0 || existing.length >= cap) {
    return existing.map((draft, index) => ({ ...draft, sortOrder: index + 1 }));
  }

  const needed = cap - existing.length;
  const pack = generatePromptPack(input, { count: cap });
  const used = new Set(existing.map((draft) => draft.text.trim().toLowerCase()));
  const counts = mixCounts(existing);
  const additions: PromptDraft[] = [];
  const candidates = pack.filter((draft) => !used.has(draft.text.trim().toLowerCase()));

  while (additions.length < needed && candidates.length > 0) {
    candidates.sort((a, b) => {
      const aCount = counts[a.mix] + additions.filter((row) => row.mix === a.mix).length;
      const bCount = counts[b.mix] + additions.filter((row) => row.mix === b.mix).length;
      if (aCount !== bCount) return aCount - bCount;
      return a.sortOrder - b.sortOrder;
    });
    const next = candidates.shift();
    if (!next) break;
    const key = next.text.trim().toLowerCase();
    if (used.has(key)) continue;
    used.add(key);
    additions.push(next);
  }

  return [...existing, ...additions].map((draft, index) => ({
    ...draft,
    sortOrder: index + 1,
  }));
}

export function generatePromptPack(input: PromptPackInput, options?: PromptCountOptions): PromptDraft[] {
  const brand = slot(input.brand, "the brand");
  const category = lowerPhrase(slot(input.category, "software"));
  const buyer = slot(input.buyer, "teams");
  const job = lowerPhrase(slot(input.job, "the work"));
  const vertical = input.vertical ? lowerPhrase(slot(input.vertical, buyer)) : "";
  const market = cleanBusinessText(input.market || "US");
  const incumbent = slot(input.incumbent, "the incumbent");
  const constraint = constraintPhrase(lowerPhrase(slot(input.constraint, "fast setup")));
  const buyerLabel = buyerContext(buyer);
  const verticalLabel = vertical || buyerLabel;
  const comps = input.competitors.map((name) => cleanBusinessText(name)).filter(Boolean);
  const comp = comps[0] || "a rival";
  const compB = comps[1] || comps[0] || "another rival";
  const count = Math.max(1, options?.count ?? PROMPT_COUNT);

  // Default pack is unbranded buyer questions — never insert the client name (PAIN §5).
  void brand;
  const lines: Array<{ mix: PromptMix; text: string }> = [
    { mix: "discovery", text: `What ${category} should a ${buyerLabel} in ${market} look at first` },
    { mix: "discovery", text: `How do ${buyerLabel} usually choose a ${category}` },
    { mix: "discovery", text: `What should I know before I hire a ${category}` },
    { mix: "discovery", text: `Best ${category} options ${constraint} in ${PROMPT_YEAR}` },
    { mix: "comparison", text: `Best ${category} for ${buyerLabel} in ${market}` },
    { mix: "comparison", text: `${comp} vs ${compB} vs other ${category} options` },
    { mix: "comparison", text: `Which ${category} is worth it if budget is tight` },
    { mix: "comparison", text: `Who is a good alternative to ${comp}` },
    { mix: "job", text: `Who should I hire to ${job} in ${market}` },
    { mix: "job", text: `Best ${category} if I need to ${job} this quarter` },
    { mix: "job", text: `${category} for a team that already has ${incumbent}` },
    { mix: "job", text: `Who actually does ${job}, not just talks about it` },
    { mix: "switch", text: `I am unhappy with ${comp}. What are my options` },
    { mix: "switch", text: `Reasons teams leave ${comp}` },
    { mix: "switch", text: `What to switch to if ${comp} is too expensive` },
    { mix: "switch", text: `When should ${buyerLabel} leave ${incumbent}` },
    { mix: "incumbent", text: `${incumbent} alternatives for teams in ${market} that need to ${job}` },
    { mix: "incumbent", text: `Who is better than ${incumbent} for ${verticalLabel}` },
    { mix: "incumbent", text: `${compB} vs ${incumbent} for ${buyerLabel}` },
    { mix: "incumbent", text: `Recommend ${articleFor(category)} ${category} tool instead of ${incumbent}` },
  ];

  if (count > PROMPT_COUNT) {
    lines.push(
      { mix: "discovery", text: `Best ${category} shortlist for ${buyerLabel} this quarter` },
      { mix: "discovery", text: `Which ${category} vendors are trusted by ${verticalLabel} teams` },
      { mix: "comparison", text: `Compare the top ${category} for ${job}` },
      { mix: "comparison", text: `${comp} vs ${incumbent} for ${buyerLabel}` },
      { mix: "job", text: `${category} that can ${job} ${constraint}` },
      { mix: "job", text: `${category} for ${buyerLabel} who need faster onboarding` },
      { mix: "switch", text: `Why do ${buyerLabel} leave ${incumbent}` },
      { mix: "switch", text: `Switching from ${incumbent} when ${job} matters more` },
      { mix: "incumbent", text: `Replace ${incumbent} for ${buyerLabel} in ${market}` },
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
      intent: line.mix,
      branded: isBrandedPrompt(line.text, brand),
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
    const market = cleanBusinessText(input.market || "US");
    const incumbent = slot(input.incumbent, "the incumbent");
    const competitors = input.competitors.map((name) => cleanBusinessText(name)).filter(Boolean).join(", ");
    const constraint = slot(input.constraint, "fast setup");
    const userContent = `You are a senior product marketer designing AI-search tracking prompts.

Create a ${count}-prompt set of high-intent buyer questions a real prospect would ask ChatGPT, Gemini, Grok, or AI Overviews while choosing vendors this week.

Category: ${category}
Buyer: ${buyer}
Job-to-be-done: ${job}
Market: ${market}
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
- Do NOT put the client brand name in any question. Competitors and category only (unbranded pack).
- Include the market when it changes buyer context or vendor availability.
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

/** Infer mix from labels or buyer-question shape — not solely list position. */
export function inferMixFromText(text: string): PromptMix | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const labeled = trimmed.match(MIX_LABEL_PREFIX);
  if (labeled) {
    const fromLabel = mixFromPrefixLabel(labeled[1] || "");
    if (fromLabel) return fromLabel;
  }
  const t = stripMixLabelPrefix(trimmed).toLowerCase();

  if (/\bvs\.?\b|\bversus\b/.test(t)) return "comparison";
  if (/\b(switch(?:ing)?|leave|still worth|problems with|why do .+ leave)\b/.test(t)) return "switch";
  if (/\b(instead of|better than|replacement|replace\b|who is better)\b/.test(t)) return "incumbent";
  if (
    /\b(alternatives? for|compared to)\b/.test(t) &&
    !/\b(best|top)\b/.test(t)
  ) {
    // "X alternatives for …" is incumbent-seeded unless it's an explicit vs/compare.
    if (/\bvs\.?\b|\bversus\b|\bcompared to\b/.test(t)) return "comparison";
    return "incumbent";
  }
  // "which tool should buyer use…" is Discovery shortlisting (not Job constraint).
  if (/\bwhich .+ (?:tool|platform|software|vendor) should\b/.test(t)) {
    return "discovery";
  }
  if (
    /\b(which .+ (?:tool|platform|software|vendor) (?:can|help)|affordable .+ for|that need(?:s)? to|with (?:slack|google drive)|who need to)\b/.test(
      t,
    )
  ) {
    return "job";
  }
  if (/\b(best|top|which .+ (?:tool|platform|vendor|option|shortlist))\b/.test(t)) return "discovery";
  if (/\balternatives?\b/.test(t)) return "incumbent";
  return null;
}

/** Parse LLM numbered list; mix from content heuristics (labels / shape), not slot alone. */
export function parseNumberedPrompts(content: string, count = PROMPT_COUNT): PromptDraft[] {
  const lines = content
    .split("\n")
    .map((line) => ensureQuestion(cleanBusinessText(line.replace(/^\s*\d+[.)]\s*/, ""))))
    .filter(Boolean);
  if (lines.length < count) {
    return [];
  }

  const positionFallback = generatePromptPack(
    {
      brand: "brand",
      category: "category",
      buyer: "buyer",
      incumbent: "incumbent",
      competitors: [],
    },
    { count },
  );

  const drafts = lines.slice(0, count).map((line, index) => {
    const inferred = inferMixFromText(line);
    return normalizePromptDraft({
      text: line,
      mix: inferred ?? positionFallback[index]?.mix ?? MIXES[index % MIXES.length],
      intent: inferred ?? positionFallback[index]?.mix ?? MIXES[index % MIXES.length],
      branded: isBrandedPrompt(line, "brand"),
      sortOrder: index + 1,
    });
  });

  // Prefer content tags; rebalance to 4+4+4+4+4 for locked packs when needed.
  // Over-subscribed inferences yield capacity to underfilled mixes so save-time lock passes.
  if (count >= PROMPT_COUNT) {
    const locked = drafts.slice(0, PROMPT_COUNT);
    if (!mixIsLocked(locked)) {
      const inferred = locked.map((draft) => inferMixFromText(draft.text));
      const assigned: Array<PromptMix | null> = locked.map(() => null);
      const counts = mixCounts([]);
      for (let i = 0; i < locked.length; i++) {
        const mix = inferred[i];
        if (!mix || counts[mix] >= MIX_TARGET) continue;
        assigned[i] = mix;
        counts[mix] += 1;
      }
      for (let i = 0; i < locked.length; i++) {
        if (assigned[i]) continue;
        const needed =
          MIXES.find((mix) => counts[mix] < MIX_TARGET) ??
          positionFallback[i]?.mix ??
          MIXES[i % MIXES.length];
        assigned[i] = needed;
        counts[needed] += 1;
      }
      for (let i = 0; i < locked.length; i++) {
        const mix = assigned[i];
        if (mix) locked[i]!.mix = mix;
      }
    }
  }

  return drafts;
}
