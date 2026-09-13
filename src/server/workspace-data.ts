import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import type { AppContext } from "@/lib/session";
import { brands, competitors, prompts, reports, runRows, runs } from "@/db/schema";

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
      const reportList = await ctx.db
        .select()
        .from(reports)
        .where(eq(reports.brandId, brand.id))
        .orderBy(desc(reports.createdAt))
        .limit(2);
      const promptCountRows = await ctx.db
        .select({ id: prompts.id })
        .from(prompts)
        .where(eq(prompts.brandId, brand.id));
      const latestReport = reportList[0] ?? null;
      const previousReport = reportList[1] ?? null;
      const mentionedDelta =
        latestReport?.scoreMentioned != null && previousReport?.scoreMentioned != null
          ? latestReport.scoreMentioned - previousReport.scoreMentioned
          : null;
      return {
        brand,
        latestRun: latestRun ?? null,
        latestReport,
        previousReport,
        promptCount: promptCountRows.length,
        mentionedDelta,
      };
    }),
  );

  return results;
}

export async function getBrandInsights(ctx: AppContext, brandId: string) {
  const reportList = await ctx.db
    .select()
    .from(reports)
    .where(eq(reports.brandId, brandId))
    .orderBy(desc(reports.createdAt))
    .limit(8);

  const latest = reportList[0] ?? null;
  const previous = reportList[1] ?? null;
  const mentionedDelta =
    latest?.scoreMentioned != null && previous?.scoreMentioned != null
      ? latest.scoreMentioned - previous.scoreMentioned
      : null;

  let recommendedCount: number | null = null;
  let missingQuestions: string[] = [];
  const trend = [...reportList].reverse().map((report) => ({
    period: report.createdAt.toISOString().slice(0, 10),
    mentioned: report.scoreMentioned ?? 0,
  }));

  if (latest) {
    const rows = await ctx.db
      .select({
        promptId: runRows.promptId,
        promptText: prompts.text,
        mentioned: runRows.mentioned,
        recommended: runRows.recommended,
      })
      .from(runRows)
      .innerJoin(prompts, eq(prompts.id, runRows.promptId))
      .where(eq(runRows.runId, latest.runId));

    const byPrompt = new Map<string, { text: string; mentioned: boolean; recommended: boolean }>();
    for (const row of rows) {
      const current = byPrompt.get(row.promptId) ?? {
        text: row.promptText,
        mentioned: false,
        recommended: false,
      };
      if (row.mentioned) current.mentioned = true;
      if (row.recommended) current.recommended = true;
      byPrompt.set(row.promptId, current);
    }
    const list = [...byPrompt.values()];
    if (list.length > 0) {
      recommendedCount = list.filter((item) => item.recommended).length;
      missingQuestions = list
        .filter((item) => !item.mentioned)
        .slice(0, 3)
        .map((item) => item.text);
    }
  }

  return {
    mentionedDelta,
    recommendedCount,
    recommendedTotal: latest?.scoreTotal ?? 20,
    missingQuestions,
    trend,
  };
}

export async function recommendedCountsForRuns(ctx: AppContext, runIds: string[]) {
  if (runIds.length === 0) return {} as Record<string, number>;
  const rows = await ctx.db
    .select({
      runId: runRows.runId,
      promptId: runRows.promptId,
      recommended: runRows.recommended,
    })
    .from(runRows)
    .where(inArray(runRows.runId, runIds));

  const byRun = new Map<string, Map<string, boolean>>();
  for (const row of rows) {
    const promptsMap = byRun.get(row.runId) ?? new Map<string, boolean>();
    const prev = promptsMap.get(row.promptId) ?? false;
    promptsMap.set(row.promptId, prev || Boolean(row.recommended));
    byRun.set(row.runId, promptsMap);
  }

  const counts: Record<string, number> = {};
  for (const [runId, promptsMap] of byRun) {
    counts[runId] = [...promptsMap.values()].filter(Boolean).length;
  }
  return counts;
}
