import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { runFridayCron } from "@/lib/cron-friday";
import { guardInternalRoute } from "@/lib/internal-guard";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/**
 * Friday cron trigger (also invoked from Worker scheduled handler).
 * Enqueues only workspaces whose timezone is local Friday 06:00.
 * Protected by CRON_SECRET (required outside development).
 * Pass ?force=1 to enqueue all workspaces (local/dev).
 */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await guardInternalRoute(request, env, "CRON_SECRET");
  if (denied) {
    return denied;
  }

  try {
    const url = new URL(request.url);
    const force = url.searchParams.get("force") === "1";
    const db = await getDb();
    const result = await runFridayCron(db, env, { force });
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/friday]", error);
    return jsonError(error instanceof Error ? error.message : "Cron failed.", 500);
  }
}

export async function GET() {
  return jsonOk({
    ok: true,
    schedule: "Hourly Worker cron; enqueues when workspace timezone is Friday 06:00 local",
    trigger: "POST /api/cron/friday",
    force: "POST /api/cron/friday?force=1",
  });
}
