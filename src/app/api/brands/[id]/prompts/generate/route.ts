import { getCloudflareContext } from "@opennextjs/cloudflare";
import { workspaceEntitlements } from "@/lib/entitlements";
import {
  generatePromptPackMaybeLlm,
  normalizePromptDrafts,
  topUpPromptDrafts,
  type PromptDraft,
} from "@/lib/prompts";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { getBrandBundle } from "@/server/workspace-data";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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
  const ent = workspaceEntitlements(sub);

  const body = (await request.json().catch(() => ({}))) as {
    existing?: PromptDraft[];
    mode?: "replace" | "topup";
  };
  const existing = normalizePromptDrafts(body.existing ?? []);
  const packInput = {
    brand: bundle.brand.name,
    category: bundle.brand.category || bundle.brand.vertical || "software",
    buyer: bundle.brand.buyer || "teams",
    job: bundle.brand.job || undefined,
    vertical: bundle.brand.vertical || undefined,
    market: bundle.brand.market || "US",
    incumbent: bundle.brand.incumbent || "the incumbent",
    competitors: bundle.competitors.map((row) => row.name),
    constraint: bundle.brand.constraintNote || undefined,
  };

  const shouldTopUp =
    body.mode === "topup" ||
    (body.mode !== "replace" && existing.length > 0 && existing.length < ent.promptCap);

  if (shouldTopUp) {
    const prompts = topUpPromptDrafts(existing, ent.promptCap, packInput);
    return jsonOk({ prompts, source: "template" as const, promptCap: ent.promptCap, toppedUp: true });
  }

  const generated = await generatePromptPackMaybeLlm(packInput, env, {
    workspace_id: ctx.workspace.id,
    brand_id: bundle.brand.id,
    plan: sub?.plan || "agency",
    count: ent.promptCap,
  });

  return jsonOk({
    ...generated,
    prompts: normalizePromptDrafts(generated.prompts),
    promptCap: ent.promptCap,
    toppedUp: false,
  });
}
