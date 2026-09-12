import { eq } from "drizzle-orm";
import type { Database } from "@/db";
import {
  brandKits,
  brands,
  competitors,
  prompts,
  reports,
  runRows,
  runs,
  workspaces,
} from "@/db/schema";
import { queryEngine } from "@/lib/engine-adapters";
import { readEngineCache, writeEngineCache } from "@/lib/engine-cache";
import { ENGINES, emptyEngineStatus, type EngineId, type EngineStatusMap } from "@/lib/engines";
import { extractFromAnswer } from "@/lib/extractor";
import { putReportObject, reportObjectKeys } from "@/lib/r2";
import { writeReport, type PromptAgg } from "@/lib/report-writer";
import { sendTransactionalEmail } from "@/lib/email";

const SOFT_FAIL_MIN = 3;

export type ProcessRunResult = {
  runId: string;
  status: "running" | "complete" | "partial" | "failed";
  engines: EngineStatusMap;
  reportId: string | null;
  scoreMentioned: number | null;
};

async function loadRunBundle(db: Database, runId: string) {
  const [row] = await db
    .select({
      run: runs,
      brand: brands,
      workspace: workspaces,
    })
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .innerJoin(workspaces, eq(workspaces.id, brands.workspaceId))
    .where(eq(runs.id, runId))
    .limit(1);

  if (!row) {
    return null;
  }

  const [promptRows, competitorRows] = await Promise.all([
    db.select().from(prompts).where(eq(prompts.brandId, row.brand.id)).orderBy(prompts.sortOrder),
    db.select().from(competitors).where(eq(competitors.brandId, row.brand.id)),
  ]);

  return { ...row, promptRows, competitorRows };
}

export async function processRun(
  db: Database,
  env: CloudflareEnv,
  runId: string,
  options?: { notifyEmail?: string | null },
): Promise<ProcessRunResult> {
  const bundle = await loadRunBundle(db, runId);
  if (!bundle) {
    throw new Error("Run not found.");
  }

  if (bundle.run.status === "complete" || bundle.run.status === "partial") {
    const [existing] = await db.select().from(reports).where(eq(reports.runId, runId)).limit(1);
    return {
      runId,
      status: bundle.run.status as "complete" | "partial",
      engines: JSON.parse(bundle.run.engineStates || "{}") as EngineStatusMap,
      reportId: existing?.id ?? null,
      scoreMentioned: existing?.scoreMentioned ?? null,
    };
  }

  const engines = emptyEngineStatus();
  await db
    .update(runs)
    .set({ status: "running", engineStates: JSON.stringify(engines) })
    .where(eq(runs.id, runId));

  // Clear prior rows if reprocessing.
  await db.delete(runRows).where(eq(runRows.runId, runId));

  const [kit] = await db
    .select()
    .from(brandKits)
    .where(eq(brandKits.workspaceId, bundle.workspace.id))
    .limit(1);
  const agencyName = kit?.preparedBy || bundle.workspace.name;

  const competitorNames = bundle.competitorRows.map((row) => row.name);
  const aggs = new Map<string, PromptAgg>();
  for (const prompt of bundle.promptRows) {
    aggs.set(prompt.id, {
      promptId: prompt.id,
      promptText: prompt.text,
      sortOrder: prompt.sortOrder,
      byEngine: {},
    });
  }

  for (const engine of ENGINES) {
    engines[engine.id] = "running";
    await db
      .update(runs)
      .set({ engineStates: JSON.stringify(engines) })
      .where(eq(runs.id, runId));

    try {
      for (const prompt of bundle.promptRows) {
        const cached = await readEngineCache(db, engine.id, prompt.text);
        let rawAnswer: string;
        let extracted = cached?.extracted ?? null;

        if (cached) {
          rawAnswer = cached.rawAnswer;
        } else {
          const result = await queryEngine({
            engine: engine.id,
            prompt: prompt.text,
            brand: bundle.brand.name,
            competitors: competitorNames,
            buyer: bundle.brand.buyer,
            env,
          });
          rawAnswer = result.rawAnswer;
          extracted = extractFromAnswer({
            brand: bundle.brand.name,
            competitors: competitorNames,
            prompt: prompt.text,
            engine: engine.id,
            rawAnswer,
            incumbent: bundle.brand.incumbent,
            category: bundle.brand.category || bundle.brand.vertical,
          });
          await writeEngineCache(db, {
            engine: engine.id,
            promptText: prompt.text,
            rawAnswer,
            extracted,
          });
        }

        if (!extracted) {
          extracted = extractFromAnswer({
            brand: bundle.brand.name,
            competitors: competitorNames,
            prompt: prompt.text,
            engine: engine.id,
            rawAnswer,
            incumbent: bundle.brand.incumbent,
            category: bundle.brand.category || bundle.brand.vertical,
          });
        }

        await db.insert(runRows).values({
          id: crypto.randomUUID(),
          runId,
          promptId: prompt.id,
          engine: engine.id,
          mentioned: extracted.mentioned,
          recommended: extracted.recommended,
          rankInShortlist: extracted.rankInShortlist,
          citedUrls: JSON.stringify(extracted.citedUrls),
          citedBrandUrl: extracted.citedBrandUrl,
          whoWon: extracted.whoWon,
          othersNamed: JSON.stringify(extracted.othersNamed),
          sentence: extracted.sentence,
          nextAction: extracted.nextAction,
          rawAnswer,
          status: "complete",
          createdAt: new Date(),
        });

        const agg = aggs.get(prompt.id)!;
        agg.byEngine[engine.id] = {
          mentioned: extracted.mentioned,
          whoWon: extracted.whoWon,
          sentence: extracted.sentence,
          nextAction: extracted.nextAction,
          citedUrls: extracted.citedUrls,
          status: "complete",
        };
      }
      engines[engine.id] = "complete";
    } catch (error) {
      console.error(`[run-processor] engine ${engine.id} failed`, error);
      engines[engine.id] = "failed";
      for (const prompt of bundle.promptRows) {
        await db.insert(runRows).values({
          id: crypto.randomUUID(),
          runId,
          promptId: prompt.id,
          engine: engine.id,
          mentioned: null,
          recommended: null,
          status: "failed",
          createdAt: new Date(),
        });
        const agg = aggs.get(prompt.id)!;
        agg.byEngine[engine.id] = {
          mentioned: false,
          whoWon: null,
          sentence: null,
          nextAction: null,
          citedUrls: [],
          status: "failed",
        };
      }
    }

    await db
      .update(runs)
      .set({ engineStates: JSON.stringify(engines) })
      .where(eq(runs.id, runId));
  }

  const successCount = ENGINES.filter((engine) => engines[engine.id] === "complete").length;
  const failedEngines = ENGINES.filter((engine) => engines[engine.id] === "failed").map((e) => e.label);

  if (successCount < SOFT_FAIL_MIN) {
    await db
      .update(runs)
      .set({
        status: "failed",
        engineStates: JSON.stringify(engines),
        completedAt: new Date(),
      })
      .where(eq(runs.id, runId));
    return {
      runId,
      status: "failed",
      engines,
      reportId: null,
      scoreMentioned: null,
    };
  }

  const partial = successCount < ENGINES.length;
  const written = writeReport({
    agency: agencyName,
    brand: bundle.brand.name,
    period: bundle.run.periodStart || new Date().toISOString().slice(0, 10),
    competitors: competitorNames,
    prompts: [...aggs.values()],
    partial,
    failedEngines,
    accentColor: kit?.accentColor || undefined,
    logoUrl: kit?.logoUrl || undefined,
  });

  const ymd = (bundle.run.periodStart || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const keys = reportObjectKeys(bundle.workspace.id, bundle.brand.id, ymd);
  await putReportObject(env, keys.htmlKey, written.html, "text/html; charset=utf-8");
  await putReportObject(env, keys.pdfKey, written.pdfBytes, "application/pdf");

  const shareToken = crypto.randomUUID().replaceAll("-", "");
  const reportId = crypto.randomUUID();
  const [existing] = await db.select().from(reports).where(eq(reports.runId, runId)).limit(1);
  if (existing) {
    await db
      .update(reports)
      .set({
        r2Key: keys.pdfKey,
        htmlKey: keys.htmlKey,
        summary: written.summary,
        agencyName,
        scoreMentioned: written.scoreMentioned,
        scoreTotal: written.scoreTotal,
        shareToken: existing.shareToken ?? shareToken,
        shareExpiresAt: existing.shareExpiresAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .where(eq(reports.id, existing.id));
  } else {
    await db.insert(reports).values({
      id: reportId,
      runId,
      brandId: bundle.brand.id,
      r2Key: keys.pdfKey,
      htmlKey: keys.htmlKey,
      summary: written.summary,
      agencyName,
      scoreMentioned: written.scoreMentioned,
      scoreTotal: written.scoreTotal,
      shareToken,
      shareExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });
  }

  const finalStatus = partial ? "partial" : "complete";
  await db
    .update(runs)
    .set({
      status: finalStatus,
      engineStates: JSON.stringify(engines),
      completedAt: new Date(),
    })
    .where(eq(runs.id, runId));

  if (options?.notifyEmail) {
    try {
      await sendTransactionalEmail({
        to: options.notifyEmail,
        subject: `${bundle.brand.name}: Friday report ready`,
        html: `<p>Your CiteBrief report for <strong>${bundle.brand.name}</strong> is ready.</p><p>${written.summary}</p>`,
        env,
      });
    } catch (error) {
      console.info("[run-processor] email stub/error", error);
    }
  }

  return {
    runId,
    status: finalStatus,
    engines,
    reportId: existing?.id ?? reportId,
    scoreMentioned: written.scoreMentioned,
  };
}

/** Soft-fail one engine for local testing of partial PDFs. */
export function shouldForceEngineFailure(engine: EngineId, forceFailEngine?: string | null) {
  return Boolean(forceFailEngine && forceFailEngine === engine);
}
