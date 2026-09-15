import { and, eq, isNull } from "drizzle-orm";
import { brands, competitors, prompts, reports, runRows, runs } from "@/db/schema";
import type { Database } from "@/db";
import { SAMPLE_REPORT } from "@/components/marketing/sample-report-data";
import { BRAND_KIND } from "@/lib/brand-kind";
import { AGENCY_ENGINE_IDS } from "@/lib/engines";
import { generatePromptPack } from "@/lib/prompts";
import { writeReport, type PromptAgg } from "@/lib/report-writer";

const SAMPLE_SITE = "https://northstar.example";
const SAMPLE_COMPETITORS = ["ClickUp", "Asana", "Monday.com"];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function fridayOnOrBefore(now: Date) {
  const d = new Date(now);
  const day = d.getUTCDay();
  const back = day >= 5 ? day - 5 : day + 2;
  d.setUTCDate(d.getUTCDate() - back);
  d.setUTCHours(16, 0, 0, 0);
  return d;
}

function engineNamed(promptIndex: number, engineIndex: number) {
  return (promptIndex + engineIndex) % 5 !== 0;
}

/** Idempotent. Skips workspaces that already have a sample or a real client brand. */
export async function ensureSampleBrand(db: Database, workspaceId: string, now = new Date()) {
  const [existing] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.workspaceId, workspaceId), eq(brands.kind, BRAND_KIND.sample)))
    .limit(1);
  if (existing) return existing.id;

  const [client] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(
      and(eq(brands.workspaceId, workspaceId), eq(brands.kind, BRAND_KIND.client), isNull(brands.archivedAt)),
    )
    .limit(1);
  if (client) return null;

  const brandId = crypto.randomUUID();
  const friday = fridayOnOrBefore(now);
  const pack = generatePromptPack(
    {
      brand: SAMPLE_REPORT.brand,
      category: "project management software",
      buyer: "agencies",
      job: "run client retainers",
      incumbent: "Asana",
      competitors: SAMPLE_COMPETITORS,
    },
    { count: 20 },
  );

  await db.insert(brands).values({
    id: brandId,
    workspaceId,
    name: SAMPLE_REPORT.brand,
    siteUrl: SAMPLE_SITE,
    vertical: "B2B SaaS",
    category: "project management software",
    buyer: "agencies",
    job: "run client retainers",
    incumbent: "Asana",
    clientOwner: SAMPLE_REPORT.agency,
    kind: BRAND_KIND.sample,
    createdAt: new Date(friday.getTime() - 8 * WEEK_MS),
    updatedAt: friday,
  });

  await db.insert(competitors).values(
    SAMPLE_COMPETITORS.map((name) => ({
      id: crypto.randomUUID(),
      brandId,
      name,
      createdAt: friday,
    })),
  );

  const promptRows = pack.map((draft, index) => ({
    id: crypto.randomUUID(),
    brandId,
    text: draft.text,
    mix: draft.mix,
    sortOrder: index + 1,
    createdAt: friday,
    updatedAt: friday,
  }));
  await db.insert(prompts).values(promptRows);

  const trendNamed = [8, 9, 10, 10, 11, 11, 12, SAMPLE_REPORT.named];
  const trendRec = [4, 5, 5, 6, 6, 6, 7, SAMPLE_REPORT.recommended];
  let latestRunId = "";
  let latestReportId = "";

  for (let week = 0; week < 8; week += 1) {
    const createdAt = new Date(friday.getTime() - (7 - week) * WEEK_MS);
    const period = createdAt.toISOString().slice(0, 10);
    const runId = crypto.randomUUID();
    const reportId = crypto.randomUUID();
    const named = trendNamed[week] ?? SAMPLE_REPORT.named;
    const recommended = trendRec[week] ?? SAMPLE_REPORT.recommended;
    const isLatest = week === 7;
    if (isLatest) {
      latestRunId = runId;
      latestReportId = reportId;
    }

    await db.insert(runs).values({
      id: runId,
      brandId,
      status: "complete",
      periodStart: period,
      periodEnd: period,
      engineStates: JSON.stringify({
        chatgpt: "complete",
        gemini: "complete",
        grok: "complete",
        aio: "complete",
        claude: "skipped",
        perplexity: "skipped",
      }),
      createdAt,
      completedAt: createdAt,
    });

    await db.insert(reports).values({
      id: reportId,
      runId,
      brandId,
      summary: isLatest
        ? SAMPLE_REPORT.summary
        : `${SAMPLE_REPORT.brand} was named in ${named} of 20 buyer questions this week.`,
      agencyName: SAMPLE_REPORT.agency,
      scoreMentioned: named,
      scoreRecommended: recommended,
      scoreTotal: 20,
      shareToken: isLatest ? crypto.randomUUID().replaceAll("-", "") : null,
      shareExpiresAt: isLatest ? new Date(friday.getTime() + 90 * 24 * 60 * 60 * 1000) : null,
      sentAt: createdAt,
      approvalState: "approved",
      approvedAt: createdAt,
      createdAt,
    });
  }

  const aggs: PromptAgg[] = promptRows.map((prompt, promptIndex) => {
    const named = promptIndex < SAMPLE_REPORT.named;
    const winner = named
      ? SAMPLE_REPORT.brand
      : SAMPLE_COMPETITORS[promptIndex % SAMPLE_COMPETITORS.length]!;
    const byEngine: PromptAgg["byEngine"] = {};
    AGENCY_ENGINE_IDS.forEach((engineId, engineIndex) => {
      const hit = named && engineNamed(promptIndex, engineIndex);
      const brandUrl = `${SAMPLE_SITE}/compare`;
      const rivalUrl = `https://www.g2.com/products/${winner.toLowerCase().replace(/\s+/g, "-")}`;
      byEngine[engineId] = {
        mentioned: hit,
        recommended: hit && engineIndex === 0,
        whoWon: hit ? SAMPLE_REPORT.brand : winner,
        sentence: hit
          ? `${SAMPLE_REPORT.brand} appears; ${winner} leads this buyer question.`
          : `${SAMPLE_REPORT.brand} is missing; ${winner} wins this buyer question.`,
        nextAction: SAMPLE_REPORT.priorities[promptIndex % SAMPLE_REPORT.priorities.length]?.action ?? null,
        citedUrls: hit ? [brandUrl, rivalUrl] : [rivalUrl],
        citedBrandUrl: hit,
        status: "complete",
      };
    });
    return {
      promptId: prompt.id,
      promptText: prompt.text,
      sortOrder: prompt.sortOrder,
      byEngine,
    };
  });

  await db.insert(runRows).values(
    aggs.flatMap((agg) =>
      AGENCY_ENGINE_IDS.map((engineId) => {
        const cell = agg.byEngine[engineId]!;
        return {
          id: crypto.randomUUID(),
          runId: latestRunId,
          promptId: agg.promptId,
          engine: engineId,
          mentioned: cell.mentioned,
          recommended: Boolean(cell.recommended),
          citedUrls: JSON.stringify(cell.citedUrls),
          citedBrandUrl: Boolean(cell.citedBrandUrl),
          whoWon: cell.whoWon,
          sentence: cell.sentence,
          nextAction: cell.nextAction,
          status: "complete",
          createdAt: friday,
        };
      }),
    ),
  );

  const written = writeReport({
    agency: SAMPLE_REPORT.agency,
    brand: SAMPLE_REPORT.brand,
    period: friday.toISOString().slice(0, 10),
    competitors: SAMPLE_COMPETITORS,
    prompts: aggs,
    partial: false,
    failedEngines: [],
    trend: trendNamed.map((named, i) => ({
      period: new Date(friday.getTime() - (7 - i) * WEEK_MS).toISOString().slice(0, 10),
      mentioned: named,
      recommended: trendRec[i] ?? 0,
    })),
  });

  await db
    .update(reports)
    .set({
      summary: written.summary,
      suggestedEmailSubject: written.suggestedEmailSubject,
      suggestedEmailBody: written.suggestedEmailBody,
    })
    .where(eq(reports.id, latestReportId));

  return brandId;
}
