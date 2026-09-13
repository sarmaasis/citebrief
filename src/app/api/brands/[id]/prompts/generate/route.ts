import { getCloudflareContext } from "@opennextjs/cloudflare";
import { generatePromptPackMaybeLlm } from "@/lib/prompts";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { getBrandBundle } from "@/server/workspace-data";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;
  const bundle = await getBrandBundle(ctx, id);
  if (!bundle) {
    return jsonError("Brand not found.", 404);
  }

  const { env } = await getCloudflareContext({ async: true });
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);

  const generated = await generatePromptPackMaybeLlm(
    {
      brand: bundle.brand.name,
      category: bundle.brand.category || bundle.brand.vertical || "software",
      buyer: bundle.brand.buyer || "teams",
      job: bundle.brand.job || undefined,
      vertical: bundle.brand.vertical || undefined,
      incumbent: bundle.brand.incumbent || "the incumbent",
      competitors: bundle.competitors.map((row) => row.name),
      constraint: bundle.brand.constraintNote || undefined,
    },
    env,
    {
      workspace_id: ctx.workspace.id,
      brand_id: bundle.brand.id,
      plan: sub?.plan || "agency",
    },
  );

  return jsonOk(generated);
}
