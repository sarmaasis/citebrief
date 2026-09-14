import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { brands, competitors, prompts } from "@/db/schema";
import {
  topUpPromptDrafts,
  type PromptDraft,
  type PromptMix,
  type PromptPackInput,
} from "@/lib/prompts";

export type PromptTopUpResult = {
  brandsTouched: number;
  promptsAdded: number;
};

function brandPackInput(
  brand: typeof brands.$inferSelect,
  competitorNames: string[],
): PromptPackInput {
  return {
    brand: brand.name,
    category: brand.category || brand.vertical || "software",
    buyer: brand.buyer || "teams",
    job: brand.job || undefined,
    vertical: brand.vertical || undefined,
    incumbent: brand.incumbent || "the incumbent",
    competitors: competitorNames,
    constraint: brand.constraintNote || undefined,
  };
}

/**
 * When promptCap rises (trial → paid, or plan upgrade), append prompts on each
 * brand that already has a set but is below the new cap. Does not wipe edits.
 */
export async function topUpWorkspaceBrandPrompts(
  db: Database,
  workspaceId: string,
  promptCap: number,
): Promise<PromptTopUpResult> {
  const cap = Math.max(1, promptCap);
  const brandRows = await db
    .select()
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId), isNull(brands.archivedAt)));

  let brandsTouched = 0;
  let promptsAdded = 0;
  const now = new Date();

  for (const brand of brandRows) {
    const existingRows = await db
      .select()
      .from(prompts)
      .where(and(eq(prompts.brandId, brand.id), isNull(prompts.archivedAt)))
      .orderBy(prompts.sortOrder);

    if (existingRows.length === 0 || existingRows.length >= cap) {
      continue;
    }

    const competitorRows = await db
      .select({ name: competitors.name })
      .from(competitors)
      .where(eq(competitors.brandId, brand.id));

    const existing: PromptDraft[] = existingRows.map((row) => ({
      text: row.text,
      mix: row.mix as PromptMix,
      sortOrder: row.sortOrder,
    }));

    const topped = topUpPromptDrafts(existing, cap, brandPackInput(brand, competitorRows.map((row) => row.name)));
    const additions = topped.slice(existing.length);
    if (additions.length === 0) {
      continue;
    }

    for (const draft of additions) {
      await db.insert(prompts).values({
        id: crypto.randomUUID(),
        brandId: brand.id,
        text: draft.text.trim(),
        mix: draft.mix,
        sortOrder: draft.sortOrder,
        createdAt: now,
        updatedAt: now,
      });
    }

    brandsTouched += 1;
    promptsAdded += additions.length;
  }

  return { brandsTouched, promptsAdded };
}
