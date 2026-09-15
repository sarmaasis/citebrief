import { cache } from "react";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
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

export const LIST_PAGE_SIZE = 50;
export const HISTORY_PAGE_SIZE = 24;

export function parseListPage(raw: string | undefined, pageSize = LIST_PAGE_SIZE) {
  const parsed = Number.parseInt(raw ?? "1", 10);
  const page = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  const size = Math.max(1, pageSize);
  return { page, pageSize: size, offset: (page - 1) * size };
}

function brandsWhere(workspaceId: string, includeArchived: boolean) {
  return includeArchived
    ? eq(brands.workspaceId, workspaceId)
    : and(eq(brands.workspaceId, workspaceId), isNull(brands.archivedAt));
}

export async function listWorkspaceBrands(ctx: AppContext, includeArchived = false) {
  return ctx.db
    .select()
    .from(brands)
    .where(brandsWhere(ctx.workspace.id, includeArchived))
    .orderBy(desc(brands.createdAt));
}

/** Nav switcher: id+name only, request-cached (layout + pages). */
export const listWorkspaceBrandNav = cache(async (ctx: AppContext) => {
  return ctx.db
    .select({ id: brands.id, name: brands.name })
    .from(brands)
    .where(brandsWhere(ctx.workspace.id, false))
    .orderBy(desc(brands.createdAt));
});

export async function listWorkspaceBrandsPage(
  ctx: AppContext,
  opts: { includeArchived?: boolean; page?: number; pageSize?: number } = {},
) {
  const includeArchived = Boolean(opts.includeArchived);
  const { page, pageSize, offset } = parseListPage(String(opts.page ?? 1), opts.pageSize ?? LIST_PAGE_SIZE);
  const where = brandsWhere(ctx.workspace.id, includeArchived);
  const [rows, countRows] = await Promise.all([
    ctx.db.select().from(brands).where(where).orderBy(desc(brands.createdAt)).limit(pageSize).offset(offset),
    ctx.db.select({ n: sql<number>`count(*)` }).from(brands).where(where),
  ]);
  return { rows, total: Number(countRows[0]?.n ?? 0), page, pageSize };
}

export async function listBrandReportsPage(ctx: AppContext, brandId: string, page = 1, pageSize = HISTORY_PAGE_SIZE) {
  const parsed = parseListPage(String(page), pageSize);
  const where = eq(reports.brandId, brandId);
  const [rows, countRows] = await Promise.all([
    ctx.db
      .select({ report: reports, run: runs })
      .from(reports)
      .innerJoin(runs, eq(runs.id, reports.runId))
      .where(where)
      .orderBy(desc(reports.createdAt))
      .limit(parsed.pageSize)
      .offset(parsed.offset),
    ctx.db
      .select({ n: sql<number>`count(*)` })
      .from(reports)
      .innerJoin(runs, eq(runs.id, reports.runId))
      .where(where),
  ]);
  return { rows, total: Number(countRows[0]?.n ?? 0), page: parsed.page, pageSize: parsed.pageSize };
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

export const listHomeRows = cache(async (ctx: AppContext, brandIds?: string[]) => {
  if (brandIds && brandIds.length === 0) return [];

  const active = await ctx.db
    .select()
    .from(brands)
    .where(
      brandIds?.length
        ? and(eq(brands.workspaceId, ctx.workspace.id), inArray(brands.id, brandIds))
        : and(eq(brands.workspaceId, ctx.workspace.id), isNull(brands.archivedAt)),
    )
    .orderBy(desc(brands.createdAt));

  if (active.length === 0) return [];

  const activeIds = active.map((brand) => brand.id);

  // Latest run + top-2 reports per brand (not full history — that was a D1 scan on every /app load).
  const latestRunTs = ctx.db
    .select({
      brandId: runs.brandId,
      maxCreated: sql`max(${runs.createdAt})`.as("max_created"),
    })
    .from(runs)
    .where(inArray(runs.brandId, activeIds))
    .groupBy(runs.brandId)
    .as("latest_run_ts");

  const [latestRunRows, promptIdRows, ...reportBuckets] = await Promise.all([
    ctx.db
      .select({ run: runs })
      .from(runs)
      .innerJoin(
        latestRunTs,
        and(eq(runs.brandId, latestRunTs.brandId), eq(runs.createdAt, latestRunTs.maxCreated)),
      ),
    ctx.db
      .select({ id: prompts.id, brandId: prompts.brandId })
      .from(prompts)
      .where(and(inArray(prompts.brandId, activeIds), isNull(prompts.archivedAt))),
    // ponytail: one query per brand, each index-seeks brand_id + LIMIT 2 — avoids full history scan
    ...activeIds.map((id) =>
      ctx.db.select().from(reports).where(eq(reports.brandId, id)).orderBy(desc(reports.createdAt)).limit(2),
    ),
  ]);
  const allReports = (reportBuckets as (typeof reports.$inferSelect)[][]).flat();

  const allRuns = latestRunRows.map((row) => row.run);
  const latestRunByBrand = indexLatestByBrandId(allRuns);
  const reportsByBrand = indexTopNByBrandId(allReports, 2);

  const promptCountByBrand = new Map<string, number>();
  for (const row of promptIdRows) {
    promptCountByBrand.set(row.brandId, (promptCountByBrand.get(row.brandId) ?? 0) + 1);
  }

  const hasClient = active.some((row) => !row.kind || row.kind === "client");
  const visible = hasClient ? active.filter((brand) => brand.kind !== "sample") : active;

  const results = visible.map((brand) => {
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
});

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
    recommended: report.scoreRecommended ?? undefined,
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

/** Brands with an unsent report (Briefs sidebar badge). */
export async function countReportsReady(ctx: AppContext): Promise<number> {
  const rows = await ctx.db
    .select({ brandId: reports.brandId })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .where(
      and(
        eq(brands.workspaceId, ctx.workspace.id),
        isNull(brands.archivedAt),
        isNull(reports.sentAt),
      ),
    );
  return new Set(rows.map((row) => row.brandId)).size;
}
