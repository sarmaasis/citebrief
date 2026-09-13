import { and, eq } from "drizzle-orm";
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
import {
  CORE_ENGINES,
  SOFT_FAIL_MIN_CORE,
  emptyEngineStatus,
  parseEngineStatus,
  type EngineId,
  type EngineStatusMap,
} from "@/lib/engines";
import { extractFromAnswer } from "@/lib/extractor";
import { putReportObject, reportObjectKeys } from "@/lib/r2";
import { writeReport, type PromptAgg } from "@/lib/report-writer";
import { reportReadyEmail } from "@/emails";
import { sendTransactionalEmail } from "@/lib/email";
import { resolveRunEngines } from "@/lib/plan-engines";
import { postSlackIncomingWebhook } from "@/lib/slack";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getWorkspaceSubscription, settleBillableExtraRun, shouldSettleBillableExtra } from "@/lib/usage";

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

  const resolved = await resolveRunEngines({
    db,
    workspaceId: bundle.workspace.id,
    defaultEngines: bundle.workspace.defaultEngines,
    env,
  });
  const runEngines = resolved.engines;
  const sub = await getWorkspaceSubscription(db, bundle.workspace.id);
  const planId = sub?.plan || "agency";
  const engines = emptyEngineStatus(resolved.includeStudio);
  for (const engine of runEngines) {
    engines[engine.id] = "queued";
  }

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

  for (const engine of runEngines) {
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
        let gatewayRequestId: string | null = null;
        let confidence: string | null = cached ? "medium" : null;

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
            metadata: {
              workspace_id: bundle.workspace.id,
              brand_id: bundle.brand.id,
              run_id: runId,
              plan: planId,
              cache_policy: "fresh",
            },
          });
          rawAnswer = result.rawAnswer;
          gatewayRequestId = result.gatewayRequestId ?? null;
          confidence = result.confidence ?? (result.stubbed ? "low" : "medium");
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
          gatewayRequestId,
          confidence,
          engineAt: new Date(),
          status: "complete",
          createdAt: new Date(),
        });

        const agg = aggs.get(prompt.id)!;
        agg.byEngine[engine.id] = {
          mentioned: extracted.mentioned,
          recommended: extracted.recommended,
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
          recommended: false,
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

  const successCount = CORE_ENGINES.filter((engine) => engines[engine.id] === "complete").length;
  const failedEngines = runEngines.filter((engine) => engines[engine.id] === "failed").map((e) => e.label);

  if (successCount < SOFT_FAIL_MIN_CORE) {
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

  const ent = workspaceEntitlements(sub);

  if (options?.notifyEmail && ent.allowsEmailSend) {
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

/** Soft-fail one engine for local testing of partial PDFs. */
export function shouldForceEngineFailure(engine: EngineId, forceFailEngine?: string | null) {
  return Boolean(forceFailEngine && forceFailEngine === engine);
}

/**
 * Retry a single failed engine without counting a new run or extra-run meter.
 * Re-writes the PDF when 3+ core engines then succeed.
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
  const competitorNames = bundle.competitorRows.map((row) => row.name);

  try {
    for (const prompt of bundle.promptRows) {
      const cached = await readEngineCache(db, engineId, prompt.text);
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
          metadata: {
            workspace_id: bundle.workspace.id,
            brand_id: bundle.brand.id,
            run_id: runId,
            plan: planId,
            cache_policy: "fresh",
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
        citedUrls: JSON.stringify(extracted.citedUrls),
        citedBrandUrl: extracted.citedBrandUrl,
        whoWon: extracted.whoWon,
        othersNamed: JSON.stringify(extracted.othersNamed),
        sentence: extracted.sentence,
        nextAction: extracted.nextAction,
        rawAnswer,
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
    for (const prompt of bundle.promptRows) {
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
  for (const prompt of bundle.promptRows) {
    aggs.set(prompt.id, {
      promptId: prompt.id,
      promptText: prompt.text,
      sortOrder: prompt.sortOrder,
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
      nextAction: row.nextAction,
      citedUrls,
      status: row.status || "complete",
    };
  }

  const successCount = CORE_ENGINES.filter((engine) => engines[engine.id] === "complete").length;
  const [kit] = await db
    .select()
    .from(brandKits)
    .where(eq(brandKits.workspaceId, bundle.workspace.id))
    .limit(1);
  const agencyName = kit?.preparedBy || bundle.workspace.name;
  const failedEngines = Object.entries(engines)
    .filter(([, state]) => state === "failed")
    .map(([id]) => id);

  if (successCount < SOFT_FAIL_MIN_CORE) {
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
