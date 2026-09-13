import { getCloudflareContext } from "@opennextjs/cloudflare";
import { runRows, runs } from "@/db/schema";
import { getDb } from "@/db";
import { CORE_ENGINES } from "@/lib/engines";
import { requireInternalSecret } from "@/lib/internal-auth";
import { jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/** Internal: engine failure dashboard + top prompts by failure. */
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = requireInternalSecret(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;

  const db = await getDb();
  const allRuns = await db.select().from(runs);
  const engineFailures: Record<string, number> = {};
  for (const engine of CORE_ENGINES) engineFailures[engine.id] = 0;
  let failedRuns = 0;
  let partialRuns = 0;
  for (const run of allRuns) {
    if (run.status === "failed") failedRuns += 1;
    if (run.status === "partial") partialRuns += 1;
    let states: Record<string, string> = {};
    try {
      states = JSON.parse(run.engineStates || "{}") as Record<string, string>;
    } catch {
      states = {};
    }
    for (const [engine, state] of Object.entries(states)) {
      if (state === "failed") engineFailures[engine] = (engineFailures[engine] || 0) + 1;
    }
  }

  const failedRows = await db.select().from(runRows);
  const promptFail: Record<string, number> = {};
  for (const row of failedRows) {
    if (row.status !== "failed") continue;
    promptFail[row.promptId] = (promptFail[row.promptId] || 0) + 1;
  }
  const topPrompts = Object.entries(promptFail)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([promptId, failures]) => ({ promptId, failures }));

  return jsonOk({
    runs: allRuns.length,
    failedRuns,
    partialRuns,
    engineFailures,
    topPrompts,
  });
}
