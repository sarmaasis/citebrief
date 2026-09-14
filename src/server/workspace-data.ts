import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { brands, competitors, prompts, reports, runRows, runs } from "@/db/schema";
import { competitorSignalsFromRows } from "@/lib/command-center";
import { isSendOverdue } from "@/lib/friday-tz";
import type { AppContext } from "@/lib/session";

/** First row per brandId assuming rows are already newest-first. */
export function indexLatestByBrandId<T extends { brandId: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    if (!map.has(row.brandId)) map.set(row.brandId, row);
  }
  return map;
}

/** Up to `n` newest rows per brandId assuming rows are already newest-first. */
export function indexTopNByBrandId<T extends { brandId: string }>(rows: T[], n: number): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.brandId) ?? [];
    if (list.length < n) {
      list.push(row);
      map.set(row.brandId, list);
    }
  }
  return map;
}

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
    ctx.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.brandId, brandId), isNull(prompts.archivedAt)))
      .orderBy(prompts.sortOrder),
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

  if (active.length === 0) return [];

  const brandIds = active.map((brand) => brand.id);

  // Batched reads (Studio 25 brands ≈ 3 queries, not 75).
  const [allRuns, allReports, promptIdRows] = await Promise.all([
    ctx.db.select().from(runs).where(inArray(runs.brandId, brandIds)).orderBy(desc(runs.createdAt)),
    ctx.db
      .select()
      .from(reports)
      .where(inArray(reports.brandId, brandIds))
      .orderBy(desc(reports.createdAt)),
    ctx.db
      .select({ id: prompts.id, brandId: prompts.brandId })
      .from(prompts)
      .where(and(inArray(prompts.brandId, brandIds), isNull(prompts.archivedAt))),
  ]);

  const latestRunByBrand = indexLatestByBrandId(allRuns);
  const reportsByBrand = indexTopNByBrandId(allReports, 2);

  const promptCountByBrand = new Map<string, number>();
  for (const row of promptIdRows) {
    promptCountByBrand.set(row.brandId, (promptCountByBrand.get(row.brandId) ?? 0) + 1);
  }

  const results = active.map((brand) => {
    const reportList = reportsByBrand.get(brand.id) ?? [];
    const latestReport = reportList[0] ?? null;
    const previousReport = reportList[1] ?? null;
    const mentionedDelta =
      latestReport?.scoreMentioned != null && previousReport?.scoreMentioned != null
        ? latestReport.scoreMentioned - previousReport.scoreMentioned
        : null;
    return {
      brand,
      latestRun: latestRunByBrand.get(brand.id) ?? null,
      latestReport,
      previousReport,
      promptCount: promptCountByBrand.get(brand.id) ?? 0,
      mentionedDelta,
      competitorLeadShare: null as number | null,
      competitorLeadCount: 0,
      competitorLeader: null as string | null,
      missingSources: false,
      sendOverdue: false,
    };
  });

  const runIds = results.map((row) => row.latestRun?.id).filter((id): id is string => Boolean(id));
  if (runIds.length === 0) return results;

  const signalRows = await ctx.db
    .select({
      runId: runRows.runId,
      promptId: runRows.promptId,
      whoWon: runRows.whoWon,
      citedUrls: runRows.citedUrls,
      citedBrandUrl: runRows.citedBrandUrl,
    })
    .from(runRows)
    .where(inArray(runRows.runId, runIds));

  const byRun = new Map<string, typeof signalRows>();
  for (const row of signalRows) {
    const list = byRun.get(row.runId) ?? [];
    list.push(row);
    byRun.set(row.runId, list);
  }

  return results.map((row) => {
    const runId = row.latestRun?.id;
    const signals = runId
      ? competitorSignalsFromRows(row.brand.name, byRun.get(runId) ?? [])
      : {
          competitorLeadShare: null,
          competitorLeadCount: 0,
          competitorLeader: null,
          missingSources: false,
        };
    return { ...row, ...signals };
  });
}

export function withSendOverdue<
  T extends {
    latestReport: { sentAt: Date | string | null; createdAt?: Date | string | null } | null;
  },
>(
  rows: T[],
  args: { timezone: string; weekly: boolean; now?: Date },
): Array<T & { sendOverdue: boolean }> {
  return rows.map((row) => ({
    ...row,
    sendOverdue: isSendOverdue({
      sentAt: row.latestReport?.sentAt,
      reportCreatedAt: row.latestReport?.createdAt,
      timezone: args.timezone,
      weekly: args.weekly,
      now: args.now,
    }),
  }));
}

export async function getBrandInsights(ctx: AppContext, brandId: string, brandName = "") {
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
  let competitorLeadShare: number | null = null;
  let competitorLeadCount = 0;
  let competitorLeader: string | null = null;
  let missingSources = false;
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
        whoWon: runRows.whoWon,
        citedUrls: runRows.citedUrls,
        citedBrandUrl: runRows.citedBrandUrl,
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
    if (brandName) {
      const signals = competitorSignalsFromRows(brandName, rows);
      competitorLeadShare = signals.competitorLeadShare;
      competitorLeadCount = signals.competitorLeadCount;
      competitorLeader = signals.competitorLeader;
      missingSources = signals.missingSources;
    }
  }

  return {
    mentionedDelta,
    recommendedCount,
    recommendedTotal: latest?.scoreTotal ?? 20,
    missingQuestions,
    trend,
    competitorLeadShare,
    competitorLeadCount,
    competitorLeader,
    missingSources,
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
