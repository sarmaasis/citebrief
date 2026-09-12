import { and, desc, eq, isNull } from "drizzle-orm";
import type { AppContext } from "@/lib/session";
import { brands, competitors, prompts, reports, runs } from "@/db/schema";

export async function listWorkspaceBrands(ctx: AppContext, includeArchived = false) {
  const rows = await ctx.db
    .select()
    .from(brands)
    .where(eq(brands.workspaceId, ctx.workspace.id))
    .orderBy(desc(brands.createdAt));

  return includeArchived ? rows : rows.filter((brand) => !brand.archivedAt);
}

export async function getWorkspaceBrand(ctx: AppContext, brandId: string) {
  const [brand] = await ctx.db
    .select()
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);
  return brand ?? null;
}

export async function getBrandBundle(ctx: AppContext, brandId: string) {
  const brand = await getWorkspaceBrand(ctx, brandId);
  if (!brand) {
    return null;
  }

  const [compRows, promptRows, latestRun, latestReport] = await Promise.all([
    ctx.db.select().from(competitors).where(eq(competitors.brandId, brandId)),
    ctx.db.select().from(prompts).where(eq(prompts.brandId, brandId)).orderBy(prompts.sortOrder),
    ctx.db.select().from(runs).where(eq(runs.brandId, brandId)).orderBy(desc(runs.createdAt)).limit(1),
    ctx.db
      .select()
      .from(reports)
      .where(eq(reports.brandId, brandId))
      .orderBy(desc(reports.createdAt))
      .limit(1),
  ]);

  return {
    brand,
    competitors: compRows,
    prompts: promptRows,
    latestRun: latestRun[0] ?? null,
    latestReport: latestReport[0] ?? null,
  };
}

export async function listHomeRows(ctx: AppContext) {
  const active = await ctx.db
    .select()
    .from(brands)
    .where(and(eq(brands.workspaceId, ctx.workspace.id), isNull(brands.archivedAt)))
    .orderBy(desc(brands.createdAt));

  const results = await Promise.all(
    active.map(async (brand) => {
      const [latestRun] = await ctx.db
        .select()
        .from(runs)
        .where(eq(runs.brandId, brand.id))
        .orderBy(desc(runs.createdAt))
        .limit(1);
      const [latestReport] = await ctx.db
        .select()
        .from(reports)
        .where(eq(reports.brandId, brand.id))
        .orderBy(desc(reports.createdAt))
        .limit(1);
      return { brand, latestRun: latestRun ?? null, latestReport: latestReport ?? null };
    }),
  );

  return results;
}
