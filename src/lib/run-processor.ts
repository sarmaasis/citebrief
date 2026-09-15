import { and, desc, eq, inArray, isNull } from "drizzle-orm";
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
import { readEngineCache, writeEngineCache, mayReadEngineCache } from "@/lib/engine-cache";
import {
  CORE_ENGINES,
  TRIAL_MAX_GATEWAY_REQUESTS,
  parseEngineStatus,
  scheduledEngineStatus,
  softFailMinCore,
  type EngineId,
  type EngineStatusMap,
} from "@/lib/engines";
import { extractFromAnswer } from "@/lib/extractor";
import { putReportObject, reportObjectKeys } from "@/lib/r2";
import { clipRawAnswer } from "@/lib/extractor";
import { writeReport, type PromptAgg } from "@/lib/report-writer";
import { reportReadyEmail } from "@/emails";
import { sendTransactionalEmail } from "@/lib/email";
import { resolveRunEngines } from "@/lib/plan-engines";
import { postSlackIncomingWebhook } from "@/lib/slack";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getWorkspaceSubscription, refundFailedRunAttempt, settleBillableExtraRun, shouldSettleBillableExtra } from "@/lib/usage";
import { hydrateGatewayRunBudget, resetGatewayRunBudget } from "@/lib/ai-gateway";

const LLM_PROMPT_CONCURRENCY = 6;
const AIO_PROMPT_CONCURRENCY = 2;

async function reportTrend(db: Database, brandId: string) {
  const history = await db
    .select({
      createdAt: reports.createdAt,
      scoreMentioned: reports.scoreMentioned,
      scoreRecommended: reports.scoreRecommended,
    })
    .from(reports)
    .where(eq(reports.brandId, brandId))
    .orderBy(desc(reports.createdAt))
    .limit(8);
  return [...history].reverse().map((row) => ({
    period: row.createdAt.toISOString().slice(0, 10),
    mentioned: row.scoreMentioned ?? 0,
    recommended: row.scoreRecommended ?? undefined,
  }));
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  const concurrency = Math.max(1, Math.min(limit, items.length || 1));
  let next = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]!, index);
    }
  });
  await Promise.all(workers);
}

/** Idempotency key for one Gateway cell. Never re-fetch when this is already complete. */
export function runCellKey(promptId: string, engine: string) {
  return `${promptId}|${engine}`;
}

export function completeRunCellKeys(
  rows: Array<{ promptId: string; engine: string; status: string | null }>,
): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (row.status === "complete") keys.add(runCellKey(row.promptId, row.engine));
  }
  return keys;
}

/** Next engine still queued/running (for sequential queue fan-out). */
export function nextPendingEngineId(
  engineIds: EngineId[],
  states: EngineStatusMap,
): EngineId | null {
  for (const id of engineIds) {
    const state = states[id];
    if (state === "queued" || state === "running") return id;
  }
  return null;
}

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
    db
      .select()
      .from(prompts)
      .where(and(eq(prompts.brandId, row.brand.id), isNull(prompts.archivedAt)))
      .orderBy(prompts.sortOrder),
    db.select().from(competitors).where(eq(competitors.brandId, row.brand.id)),
  ]);

  return { ...row, promptRows, competitorRows };
}

export async function processRun(
  db: Database,
  env: CloudflareEnv,
  runId: string,
  options?: {
    notifyEmail?: string | null;
    /** Queue worker: only this engine (≈20 Gateway calls), then chain or finalize. */
    onlyEngine?: EngineId;
  },
): Promise<ProcessRunResult> {
  const bundle = await loadRunBundle(db, runId);
  if (!bundle) {
    throw new Error("Run not found.");
  }

  if (bundle.run.status === "complete" || bundle.run.status === "partial") {
    const [existing] = await db.select().from(reports).where(eq(reports.runId, runId)).limit(1);
    if (existing) {
      await settleBillableExtraRun({ db, env, workspaceId: bundle.workspace.id, runId });
    }
    return {
      runId,
      status: bundle.run.status as "complete" | "partial",
      engines: JSON.parse(bundle.run.engineStates || "{}") as EngineStatusMap,
      reportId: existing?.id ?? null,
      scoreMentioned: existing?.scoreMentioned ?? null,
    };
  }

  if (bundle.run.status === "failed") {
    return {
      runId,
      status: "failed",
      engines: parseEngineStatus(bundle.run.engineStates),
      reportId: null,
      scoreMentioned: null,
    };
  }

  // Claim queued → running. Also reclaim `running` after isolate crash / queue redelivery
  // so work continues instead of leaving the run stuck forever.
  const claimed = await db
    .update(runs)
    .set({ status: "running" })
    .where(and(eq(runs.id, runId), inArray(runs.status, ["queued", "running"])))
    .returning({ id: runs.id });
  if (claimed.length === 0) {
    const [again] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
    const snapshot = parseEngineStatus(again?.engineStates);
    const status = (again?.status || "running") as ProcessRunResult["status"];
    if (status === "complete" || status === "partial") {
      const [existing] = await db.select().from(reports).where(eq(reports.runId, runId)).limit(1);
      if (existing) {
        await settleBillableExtraRun({ db, env, workspaceId: bundle.workspace.id, runId });
      }
      return {
        runId,
        status,
        engines: snapshot,
        reportId: existing?.id ?? null,
        scoreMentioned: existing?.scoreMentioned ?? null,
      };
    }
    return {
      runId,
      status: status === "failed" ? "failed" : "running",
      engines: snapshot,
      reportId: null,
      scoreMentioned: null,
    };
  }

  // Keep durable gateway count across reclaims; only clear the in-memory map key first.
  resetGatewayRunBudget(runId);
  await hydrateGatewayRunBudget(db, runId);

  const resolved = await resolveRunEngines({
    db,
    workspaceId: bundle.workspace.id,
    defaultEngines: bundle.workspace.defaultEngines,
    env,
  });
  const runEngines = resolved.engines;
  const sub = await getWorkspaceSubscription(db, bundle.workspace.id);
  const ent = workspaceEntitlements(sub);
  const planId = sub?.plan || "agency";
  const promptCap = ent.promptCap;
  const promptRows = bundle.promptRows.slice(0, promptCap);
  const maxGatewayRequests = ent.paid
    ? Math.max(20, promptRows.length * runEngines.length * 2)
    : TRIAL_MAX_GATEWAY_REQUESTS;

  // Resume paid work: keep completed cells. Wiping them on reclaim was double-billing Gateway.
  const priorRows = await db.select().from(runRows).where(eq(runRows.runId, runId));
  const completeKeys = completeRunCellKeys(priorRows);

  // Engine jobs must not reset sibling engine status (parallel/sequential queue safety).
  const engines = options?.onlyEngine
    ? parseEngineStatus(bundle.run.engineStates)
    : scheduledEngineStatus(runEngines.map((engine) => engine.id));
  for (const engine of runEngines) {
    if (!engines[engine.id] || engines[engine.id] === "skipped") {
      engines[engine.id] = "queued";
    }
    if (promptRows.every((prompt) => completeKeys.has(runCellKey(prompt.id, engine.id)))) {
      engines[engine.id] = "complete";
    }
  }

  await db
    .update(runs)
    .set({ status: "running", engineStates: JSON.stringify(engines) })
    .where(eq(runs.id, runId));

  const [kit] = await db
    .select()
    .from(brandKits)
    .where(eq(brandKits.workspaceId, bundle.workspace.id))
    .limit(1);
  const agencyName = kit?.preparedBy || bundle.workspace.name;

  const competitorNames = bundle.competitorRows.map((row) => row.name);
  const aggs = new Map<string, PromptAgg>();
  for (const prompt of promptRows) {
    aggs.set(prompt.id, {
      promptId: prompt.id,
      promptText: prompt.text,
      sortOrder: prompt.sortOrder,
      intent: prompt.intent ?? prompt.mix,
      branded: Boolean(prompt.branded),
      byEngine: {},
    });
  }

  // Rebuild report aggs from durable completes so a reclaim can finalize without re-calling Gateway.
  for (const row of priorRows) {
    if (row.status !== "complete") continue;
    const engineId = row.engine as EngineId;
    const agg = aggs.get(row.promptId);
    if (!agg) continue;
    let citedUrls: string[] = [];
    try {
      citedUrls = row.citedUrls ? (JSON.parse(row.citedUrls) as string[]) : [];
    } catch {
      citedUrls = [];
    }
    agg.byEngine[engineId] = {
            mentioned: Boolean(row.mentioned),
            recommended: Boolean(row.recommended),
            whoWon: row.whoWon,
            sentence: row.sentence,
            verbatim: row.verbatim,
            position: row.position ?? row.rankInShortlist,
            sentiment: row.sentiment,
            nextAction: row.nextAction,
      citedUrls,
      citedBrandUrl: Boolean(row.citedBrandUrl),
      status: "complete",
    };
  }

  const enginesToRun = options?.onlyEngine
    ? runEngines.filter((engine) => engine.id === options.onlyEngine)
    : runEngines;

  for (const engine of enginesToRun) {
    if (engines[engine.id] === "complete") continue;

    engines[engine.id] = "running";
    await db
      .update(runs)
      .set({ engineStates: JSON.stringify(engines) })
      .where(eq(runs.id, runId));

    try {
      const pendingPrompts = promptRows.filter((prompt) => !completeKeys.has(runCellKey(prompt.id, engine.id)));
      const cellFailures: unknown[] = [];
      const concurrency = engine.id === "aio" ? AIO_PROMPT_CONCURRENCY : LLM_PROMPT_CONCURRENCY;

      await mapWithConcurrency(pendingPrompts, concurrency, async (prompt) => {
        const key = runCellKey(prompt.id, engine.id);
        if (completeKeys.has(key)) return;

        try {
          // Metered full runs must not read D1 engine_cache (cache hits were still debiting).
          // Still write on success so free Retry can reuse a good answer if useful.
          const result = await queryEngine({
            engine: engine.id,
            prompt: prompt.text,
            brand: bundle.brand.name,
            competitors: competitorNames,
            buyer: bundle.brand.buyer,
            env,
            db,
            metadata: {
              workspace_id: bundle.workspace.id,
              brand_id: bundle.brand.id,
              run_id: runId,
              plan: planId,
              cache_policy: "fresh",
              max_gateway_requests: maxGatewayRequests,
            },
          });
          const rawAnswer = result.rawAnswer;
          const gatewayRequestId = result.gatewayRequestId ?? null;
          const confidence = result.confidence ?? (result.stubbed ? "low" : "medium");
          const extracted = extractFromAnswer({
            brand: bundle.brand.name,
            competitors: competitorNames,
            prompt: prompt.text,
            engine: engine.id,
            rawAnswer,
            incumbent: bundle.brand.incumbent,
            category: bundle.brand.category || bundle.brand.vertical,
            siteUrl: bundle.brand.siteUrl,
          });
          await writeEngineCache(db, {
            engine: engine.id,
            promptText: prompt.text,
            rawAnswer,
            extracted,
          });

          // Drop a prior failed stub for this cell so we don't keep ghosts.
          await db
            .delete(runRows)
            .where(
              and(
                eq(runRows.runId, runId),
                eq(runRows.promptId, prompt.id),
                eq(runRows.engine, engine.id),
                eq(runRows.status, "failed"),
              ),
            );

          await db.insert(runRows).values({
            id: crypto.randomUUID(),
            runId,
            promptId: prompt.id,
            engine: engine.id,
            mentioned: extracted.mentioned,
            recommended: extracted.recommended,
            rankInShortlist: extracted.rankInShortlist,
            position: extracted.position,
            sentiment: extracted.sentiment,
            citedUrls: JSON.stringify(extracted.citedUrls),
            citedBrandUrl: extracted.citedBrandUrl,
            whoWon: extracted.whoWon,
            othersNamed: JSON.stringify(extracted.othersNamed),
            sentence: extracted.sentence,
            verbatim: extracted.verbatim,
            nextAction: extracted.nextAction,
            rawAnswer: clipRawAnswer(rawAnswer),
            gatewayRequestId,
            confidence,
            engineAt: new Date(),
            status: "complete",
            createdAt: new Date(),
          });
          completeKeys.add(key);

          const agg = aggs.get(prompt.id)!;
          agg.byEngine[engine.id] = {
            mentioned: extracted.mentioned,
            recommended: extracted.recommended,
            whoWon: extracted.whoWon,
            sentence: extracted.sentence,
            verbatim: extracted.verbatim,
            position: extracted.position,
            sentiment: extracted.sentiment,
            nextAction: extracted.nextAction,
            citedUrls: extracted.citedUrls,
            status: "complete",
          };
        } catch (error) {
          cellFailures.push(error);
        }
      });

      if (cellFailures.length > 0) {
        throw cellFailures[0];
      }
      engines[engine.id] = "complete";
    } catch (error) {
      console.error(
        `[run-processor] engine ${engine.id} failed`,
        error instanceof Error ? error.message : error,
      );
      engines[engine.id] = "failed";
      for (const prompt of promptRows) {
        const key = runCellKey(prompt.id, engine.id);
        if (completeKeys.has(key)) continue;
        await db.insert(runRows).values({
          id: crypto.randomUUID(),
          runId,
          promptId: prompt.id,
          engine: engine.id,
          mentioned: null,
          recommended: null,
          status: "unavailable",
          createdAt: new Date(),
        });
        const agg = aggs.get(prompt.id)!;
        agg.byEngine[engine.id] = {
          mentioned: false,
          recommended: false,
          whoWon: null,
          sentence: null,
          nextAction: null,
          citedUrls: [],
          citedBrandUrl: false,
          status: "unavailable",
        };
      }
    }

    await db
      .update(runs)
      .set({ engineStates: JSON.stringify(engines) })
      .where(eq(runs.id, runId));
  }

  // Queue path: one engine per message — chain the next engine instead of finishing 80 calls here.
  if (options?.onlyEngine && env.RUNS_QUEUE) {
    const next = nextPendingEngineId(
      runEngines.map((engine) => engine.id),
      engines,
    );
    if (next) {
      await env.RUNS_QUEUE.send({
        runId,
        engineId: next,
        notifyEmail: options.notifyEmail ?? null,
      });
      return {
        runId,
        status: "running",
        engines,
        reportId: null,
        scoreMentioned: null,
      };
    }
    // Last engine done — rebuild aggs from all durable rows before PDF.
    const allRows = await db.select().from(runRows).where(eq(runRows.runId, runId));
    for (const prompt of promptRows) {
      const agg = aggs.get(prompt.id)!;
      agg.byEngine = {};
    }
    for (const row of allRows) {
      const engineId = row.engine as EngineId;
      const agg = aggs.get(row.promptId);
      if (!agg) continue;
      if (row.status === "complete") {
        let citedUrls: string[] = [];
        try {
          citedUrls = row.citedUrls ? (JSON.parse(row.citedUrls) as string[]) : [];
        } catch {
          citedUrls = [];
        }
        agg.byEngine[engineId] = {
            mentioned: Boolean(row.mentioned),
            recommended: Boolean(row.recommended),
            whoWon: row.whoWon,
            sentence: row.sentence,
            verbatim: row.verbatim,
            position: row.position ?? row.rankInShortlist,
            sentiment: row.sentiment,
            nextAction: row.nextAction,
          citedUrls,
          citedBrandUrl: Boolean(row.citedBrandUrl),
          status: "complete",
        };
      } else if (row.status === "failed" || row.status === "unavailable") {
        agg.byEngine[engineId] = {
          mentioned: false,
          recommended: false,
          whoWon: null,
          sentence: null,
          nextAction: null,
          citedUrls: [],
          citedBrandUrl: false,
          status: "unavailable",
        };
      }
    }
  }

  const scheduledIds = CORE_ENGINES.filter(
    (engine) => engines[engine.id] && engines[engine.id] !== "skipped",
  ).map((engine) => engine.id);
  const successCount = scheduledIds.filter((id) => engines[id] === "complete").length;
  const failedEngines = runEngines.filter((engine) => engines[engine.id] === "failed").map((e) => e.label);

  if (successCount < softFailMinCore(scheduledIds.length)) {
    await db
      .update(runs)
      .set({
        status: "failed",
        engineStates: JSON.stringify(engines),
        completedAt: new Date(),
      })
      .where(eq(runs.id, runId));
    // Soft-cap already ignores failed rows; also undo enqueue-time runsUsed bump.
    await refundFailedRunAttempt(db, bundle.workspace.id);
    return {
      runId,
      status: "failed",
      engines,
      reportId: null,
      scoreMentioned: null,
    };
  }

  const coreTotal = CORE_ENGINES.filter((engine) => engines[engine.id] && engines[engine.id] !== "skipped").length || CORE_ENGINES.length;
  const partial = successCount < coreTotal;
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
    market: bundle.brand.market,
    trend: await reportTrend(db, bundle.brand.id),
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
        scoreRecommended: written.scoreRecommended,
        scoreTotal: written.scoreTotal,
        shareToken: existing.shareToken ?? shareToken,
        shareExpiresAt: existing.shareExpiresAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        suggestedEmailSubject: written.suggestedEmailSubject,
        suggestedEmailBody: written.suggestedEmailBody,
        approvalState: existing.sentAt ? existing.approvalState : "needs_review",
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
      scoreRecommended: written.scoreRecommended,
      scoreTotal: written.scoreTotal,
      shareToken,
      shareExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      approvalState: "needs_review",
      suggestedEmailSubject: written.suggestedEmailSubject,
      suggestedEmailBody: written.suggestedEmailBody,
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

  if (shouldSettleBillableExtra(finalStatus)) {
    await settleBillableExtraRun({ db, env, workspaceId: bundle.workspace.id, runId });
  }

  if (options?.notifyEmail) {
    try {
      const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "");
      const id = existing?.id ?? reportId;
      const mail = reportReadyEmail({
        brandName: bundle.brand.name,
        summary: written.summary,
        named: written.scoreMentioned,
        total: written.scoreTotal,
        url: origin ? `${origin}/app/brands/${bundle.brand.id}/reports/${id}` : undefined,
      });
      await sendTransactionalEmail({
        to: options.notifyEmail,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        env,
      });
    } catch (error) {
      console.error("[run-processor] email failed", error);
    }
  }

  try {
    if (ent.allowsSlack && bundle.workspace.slackWebhookUrl) {
      await postSlackIncomingWebhook({
        webhookUrl: bundle.workspace.slackWebhookUrl,
        text: `CiteBrief: ${bundle.brand.name} report ready (${written.scoreMentioned}/${written.scoreTotal} named). ${written.summary}`,
      });
    }
  } catch (error) {
    console.info("[run-processor] slack notify skipped", error);
  }

  return {
    runId,
    status: finalStatus,
    engines,
    reportId: existing?.id ?? reportId,
    scoreMentioned: written.scoreMentioned,
  };
}

/**
 * Orchestrator queue message (no engineId): claim run, then enqueue the first pending engine.
 * Redelivery resumes the chain without redoing completed Gateway cells.
 */
export async function startOrContinueRunQueue(
  db: Database,
  env: CloudflareEnv,
  runId: string,
  notifyEmail?: string | null,
): Promise<ProcessRunResult> {
  const bundle = await loadRunBundle(db, runId);
  if (!bundle) throw new Error("Run not found.");

  if (bundle.run.status === "complete" || bundle.run.status === "partial") {
    const [existing] = await db.select().from(reports).where(eq(reports.runId, runId)).limit(1);
    if (existing) {
      await settleBillableExtraRun({ db, env, workspaceId: bundle.workspace.id, runId });
    }
    return {
      runId,
      status: bundle.run.status as "complete" | "partial",
      engines: parseEngineStatus(bundle.run.engineStates),
      reportId: existing?.id ?? null,
      scoreMentioned: existing?.scoreMentioned ?? null,
    };
  }
  if (bundle.run.status === "failed") {
    return {
      runId,
      status: "failed",
      engines: parseEngineStatus(bundle.run.engineStates),
      reportId: null,
      scoreMentioned: null,
    };
  }

  const resolved = await resolveRunEngines({
    db,
    workspaceId: bundle.workspace.id,
    defaultEngines: bundle.workspace.defaultEngines,
    env,
  });
  const runEngines = resolved.engines;
  const engineIds = runEngines.map((engine) => engine.id);

  const claimed = await db
    .update(runs)
    .set({ status: "running" })
    .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
    .returning({ id: runs.id });

  if (claimed.length > 0) {
    resetGatewayRunBudget(runId);
    await hydrateGatewayRunBudget(db, runId);
    const priorRows = await db.select().from(runRows).where(eq(runRows.runId, runId));
    const completeKeys = completeRunCellKeys(priorRows);
    const sub = await getWorkspaceSubscription(db, bundle.workspace.id);
    const promptCap = workspaceEntitlements(sub).promptCap;
    const capped = bundle.promptRows.slice(0, promptCap);
    const engines = scheduledEngineStatus(engineIds);
    for (const id of engineIds) {
      if (capped.every((prompt) => completeKeys.has(runCellKey(prompt.id, id)))) {
        engines[id] = "complete";
      }
    }
    await db
      .update(runs)
      .set({ engineStates: JSON.stringify(engines) })
      .where(eq(runs.id, runId));
  }

  const [row] = await db.select().from(runs).where(eq(runs.id, runId)).limit(1);
  const engines = parseEngineStatus(row?.engineStates);
  const next = nextPendingEngineId(engineIds, engines);
  if (!next) {
    // All engines terminal — finalize via one engine job path (skips Gateway, writes PDF).
    const any = engineIds[0];
    if (!any) {
      return {
        runId,
        status: "failed",
        engines,
        reportId: null,
        scoreMentioned: null,
      };
    }
    return processRun(db, env, runId, { notifyEmail, onlyEngine: any });
  }
  if (!env.RUNS_QUEUE) {
    return processRun(db, env, runId, { notifyEmail });
  }
  await env.RUNS_QUEUE.send({
    runId,
    engineId: next,
    notifyEmail: notifyEmail ?? null,
  });
  return {
    runId,
    status: "running",
    engines,
    reportId: null,
    scoreMentioned: null,
  };
}

/** One queued engine job (~promptCap Gateway calls). */
export async function processRunEngineJob(
  db: Database,
  env: CloudflareEnv,
  runId: string,
  engineId: EngineId,
  options?: { notifyEmail?: string | null },
): Promise<ProcessRunResult> {
  return processRun(db, env, runId, {
    notifyEmail: options?.notifyEmail,
    onlyEngine: engineId,
  });
}

/** Soft-fail one engine for local testing of partial PDFs. */
export function shouldForceEngineFailure(engine: EngineId, forceFailEngine?: string | null) {
  return Boolean(forceFailEngine && forceFailEngine === engine);
}

/**
 * Retry a single failed engine without counting a new run or extra-run meter.
 * Re-writes the PDF when enough scheduled engines then succeed. Does not meter a new run.
 */
export async function retryFailedEngine(
  db: Database,
  env: CloudflareEnv,
  runId: string,
  engineId: EngineId,
): Promise<ProcessRunResult> {
  const bundle = await loadRunBundle(db, runId);
  if (!bundle) throw new Error("Run not found.");

  const engines = parseEngineStatus(bundle.run.engineStates);
  if (engines[engineId] !== "failed") {
    throw new Error("Only a failed engine can be retried.");
  }

  await db.delete(runRows).where(and(eq(runRows.runId, runId), eq(runRows.engine, engineId)));

  engines[engineId] = "running";
  await db
    .update(runs)
    .set({ status: "running", engineStates: JSON.stringify(engines) })
    .where(eq(runs.id, runId));

  const sub = await getWorkspaceSubscription(db, bundle.workspace.id);
  const planId = sub?.plan || "agency";
  const promptRows = bundle.promptRows.slice(0, workspaceEntitlements(sub).promptCap);
  const competitorNames = bundle.competitorRows.map((row) => row.name);
  resetGatewayRunBudget(`${runId}:retry:${engineId}`);
  const retryCap = Math.max(2, promptRows.length * 2);

  try {
    for (const prompt of promptRows) {
      // Free Retry may still read D1 cache (not metered). Prefer a live query when
      // there is no hit so the failed engine is actually re-checked.
      const cached = mayReadEngineCache("retryFailedEngine")
        ? await readEngineCache(db, engineId, prompt.text)
        : null;
      let rawAnswer: string;
      let extracted = cached?.extracted ?? null;
      let gatewayRequestId: string | null = null;
      let confidence: string | null = cached ? "medium" : null;

      if (cached) {
        rawAnswer = cached.rawAnswer;
      } else {
        const result = await queryEngine({
          engine: engineId,
          prompt: prompt.text,
          brand: bundle.brand.name,
          competitors: competitorNames,
          buyer: bundle.brand.buyer,
          env,
          db,
          metadata: {
            workspace_id: bundle.workspace.id,
            brand_id: bundle.brand.id,
            run_id: `${runId}:retry:${engineId}`,
            plan: planId,
            cache_policy: "fresh",
            max_gateway_requests: retryCap,
          },
        });
        rawAnswer = result.rawAnswer;
        gatewayRequestId = result.gatewayRequestId ?? null;
        confidence = result.confidence ?? (result.stubbed ? "low" : "medium");
        extracted = extractFromAnswer({
          brand: bundle.brand.name,
          competitors: competitorNames,
          prompt: prompt.text,
          engine: engineId,
          rawAnswer,
          incumbent: bundle.brand.incumbent,
          category: bundle.brand.category || bundle.brand.vertical,
          siteUrl: bundle.brand.siteUrl,
        });
        await writeEngineCache(db, {
          engine: engineId,
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
          engine: engineId,
          rawAnswer,
          incumbent: bundle.brand.incumbent,
          category: bundle.brand.category || bundle.brand.vertical,
          siteUrl: bundle.brand.siteUrl,
        });
      }

      await db.insert(runRows).values({
        id: crypto.randomUUID(),
        runId,
        promptId: prompt.id,
        engine: engineId,
        mentioned: extracted.mentioned,
        recommended: extracted.recommended,
        rankInShortlist: extracted.rankInShortlist,
        position: extracted.position,
        sentiment: extracted.sentiment,
        citedUrls: JSON.stringify(extracted.citedUrls),
        citedBrandUrl: extracted.citedBrandUrl,
        whoWon: extracted.whoWon,
        othersNamed: JSON.stringify(extracted.othersNamed),
        sentence: extracted.sentence,
        verbatim: extracted.verbatim,
        nextAction: extracted.nextAction,
        rawAnswer: clipRawAnswer(rawAnswer),
        gatewayRequestId,
        confidence,
        engineAt: new Date(),
        status: "complete",
        createdAt: new Date(),
      });
    }
    engines[engineId] = "complete";
  } catch (error) {
    console.error(`[run-processor] retry ${engineId} failed`, error);
    engines[engineId] = "failed";
    for (const prompt of promptRows) {
      await db.insert(runRows).values({
        id: crypto.randomUUID(),
        runId,
        promptId: prompt.id,
        engine: engineId,
        mentioned: null,
        recommended: null,
        status: "failed",
        createdAt: new Date(),
      });
    }
  }

  const allRows = await db.select().from(runRows).where(eq(runRows.runId, runId));
  const aggs = new Map<string, PromptAgg>();
  for (const prompt of promptRows) {
    aggs.set(prompt.id, {
      promptId: prompt.id,
      promptText: prompt.text,
      sortOrder: prompt.sortOrder,
      intent: prompt.intent ?? prompt.mix,
      branded: Boolean(prompt.branded),
      byEngine: {},
    });
  }
  for (const row of allRows) {
    const agg = aggs.get(row.promptId);
    if (!agg) continue;
    let citedUrls: string[] = [];
    if (row.citedUrls) {
      try {
        citedUrls = JSON.parse(row.citedUrls) as string[];
      } catch {
        citedUrls = [];
      }
    }
    agg.byEngine[row.engine as EngineId] = {
      mentioned: Boolean(row.mentioned),
      recommended: Boolean(row.recommended),
      whoWon: row.whoWon,
      sentence: row.sentence,
      verbatim: row.verbatim,
      position: row.position ?? row.rankInShortlist,
      sentiment: row.sentiment,
      nextAction: row.nextAction,
      citedUrls,
      status: row.status || "complete",
    };
  }

  const scheduledIds = CORE_ENGINES.filter(
    (engine) => engines[engine.id] && engines[engine.id] !== "skipped",
  ).map((engine) => engine.id);
  const successCount = scheduledIds.filter((id) => engines[id] === "complete").length;
  const [kit] = await db
    .select()
    .from(brandKits)
    .where(eq(brandKits.workspaceId, bundle.workspace.id))
    .limit(1);
  const agencyName = kit?.preparedBy || bundle.workspace.name;
  const failedEngines = Object.entries(engines)
    .filter(([, state]) => state === "failed")
    .map(([id]) => id);

  if (successCount < softFailMinCore(scheduledIds.length)) {
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

  const coreTotal =
    CORE_ENGINES.filter((engine) => engines[engine.id] && engines[engine.id] !== "skipped").length || CORE_ENGINES.length;
  const partial = successCount < coreTotal;
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
    market: bundle.brand.market,
    trend: await reportTrend(db, bundle.brand.id),
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
        scoreRecommended: written.scoreRecommended,
        scoreTotal: written.scoreTotal,
        shareToken: existing.shareToken ?? shareToken,
        shareExpiresAt: existing.shareExpiresAt ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        suggestedEmailSubject: written.suggestedEmailSubject,
        suggestedEmailBody: written.suggestedEmailBody,
        approvalState: existing.sentAt ? existing.approvalState : "needs_review",
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
      scoreRecommended: written.scoreRecommended,
      scoreTotal: written.scoreTotal,
      shareToken,
      shareExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      approvalState: "needs_review",
      suggestedEmailSubject: written.suggestedEmailSubject,
      suggestedEmailBody: written.suggestedEmailBody,
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

  // Retry never meters a new run; settle is a no-op if billedAt is already set.
  if (shouldSettleBillableExtra(finalStatus)) {
    await settleBillableExtraRun({ db, env, workspaceId: bundle.workspace.id, runId });
  }

  return {
    runId,
    status: finalStatus,
    engines,
    reportId: existing?.id ?? reportId,
    scoreMentioned: written.scoreMentioned,
  };
}
