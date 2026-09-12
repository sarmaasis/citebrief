import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { runFridayCron } from "@/lib/cron-friday";
import { requireInternalSecret } from "@/lib/internal-auth";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/**
 * Friday cron trigger.
 * Protected by CRON_SECRET (required outside development).
 */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = requireInternalSecret(request, env, "CRON_SECRET");
  if (denied) {
    return denied;
  }

  try {
    const db = await getDb();
    const result = await runFridayCron(db, env);
    return jsonOk({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/friday]", error);
    return jsonError(error instanceof Error ? error.message : "Cron failed.", 500);
  }
}

export async function GET() {
  return jsonOk({
    ok: true,
    schedule: "Friday 06:00 per workspace timezone",
    trigger: "POST /api/cron/friday",
  });
}
