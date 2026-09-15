import { and, eq, inArray, isNull } from "drizzle-orm";
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

async function topUpOneBrand(
  db: Database,
  brand: typeof brands.$inferSelect,
  competitorNames: string[],
  existingRows: Array<{ text: string; mix: string; sortOrder: number }>,
  cap: number,
  now: Date,
): Promise<number> {
  if (existingRows.length === 0 || existingRows.length >= cap) return 0;

  const existing: PromptDraft[] = existingRows.map((row) => ({
    text: row.text,
    mix: row.mix as PromptMix,
    sortOrder: row.sortOrder,
  }));

  const topped = topUpPromptDrafts(existing, cap, brandPackInput(brand, competitorNames));
  const additions = topped.slice(existing.length);
  if (additions.length === 0) return 0;

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
  return additions.length;
}

/**
 * Top up a single brand when under promptCap (prompts page recovery).
 * Avoids scanning every workspace brand on each page load.
 */
export async function topUpBrandPrompts(
  db: Database,
  brandId: string,
  promptCap: number,
): Promise<PromptTopUpResult> {
  const cap = Math.max(1, promptCap);
  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), isNull(brands.archivedAt)))
    .limit(1);
  if (!brand) return { brandsTouched: 0, promptsAdded: 0 };

  const existingRows = await db
    .select()
    .from(prompts)
    .where(and(eq(prompts.brandId, brand.id), isNull(prompts.archivedAt)))
    .orderBy(prompts.sortOrder);

  const competitorRows = await db
    .select({ name: competitors.name })
    .from(competitors)
    .where(eq(competitors.brandId, brand.id));

  const added = await topUpOneBrand(
    db,
    brand,
    competitorRows.map((row) => row.name),
    existingRows,
    cap,
    new Date(),
  );
  return { brandsTouched: added > 0 ? 1 : 0, promptsAdded: added };
}

/**
 * When promptCap rises (trial → paid, or plan upgrade), append prompts on each
 * brand that already has a set but is below the new cap. Does not wipe edits.
 * Batched competitor/prompt reads — not N+1 per brand.
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

  if (brandRows.length === 0) return { brandsTouched: 0, promptsAdded: 0 };

  const brandIds = brandRows.map((brand) => brand.id);
  const [allPrompts, allCompetitors] = await Promise.all([
    db
      .select()
      .from(prompts)
      .where(and(inArray(prompts.brandId, brandIds), isNull(prompts.archivedAt)))
      .orderBy(prompts.sortOrder),
    db.select({ brandId: competitors.brandId, name: competitors.name }).from(competitors).where(inArray(competitors.brandId, brandIds)),
  ]);

  const promptsByBrand = new Map<string, typeof allPrompts>();
  for (const row of allPrompts) {
    const list = promptsByBrand.get(row.brandId) || [];
    list.push(row);
    promptsByBrand.set(row.brandId, list);
  }
  const competitorsByBrand = new Map<string, string[]>();
  for (const row of allCompetitors) {
    const list = competitorsByBrand.get(row.brandId) || [];
    list.push(row.name);
    competitorsByBrand.set(row.brandId, list);
  }

  let brandsTouched = 0;
  let promptsAdded = 0;
  const now = new Date();

  for (const brand of brandRows) {
    const added = await topUpOneBrand(
      db,
      brand,
      competitorsByBrand.get(brand.id) || [],
      promptsByBrand.get(brand.id) || [],
      cap,
      now,
    );
    if (added > 0) {
      brandsTouched += 1;
      promptsAdded += added;
    }
  }

  return { brandsTouched, promptsAdded };
}
