import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { runFridayCron } from "@/lib/cron-friday";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/**
 * Friday 06:00 tenant TZ cron trigger stub.
 * Protect with CRON_SECRET when set; otherwise allow in stub/dev.
 */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const secret = (env as CloudflareEnv & { CRON_SECRET?: string }).CRON_SECRET;
  if (secret && secret !== "stub") {
    const header = request.headers.get("authorization");
    if (header !== `Bearer ${secret}`) {
      return jsonError("Unauthorized cron call.", 401);
    }
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
