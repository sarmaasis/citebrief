import { getCloudflareContext } from "@opennextjs/cloudflare";
import { productionSecretProblems } from "@/lib/runtime-env";
import { jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const problems = productionSecretProblems(env);
    return jsonOk({ ok: problems.length === 0, degraded: problems.length > 0 });
  } catch {
    return jsonOk({ ok: true, runtime: "local" });
  }
}
