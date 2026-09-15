import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq, gt, isNull, or } from "drizzle-orm";
import { brands, competitors, prompts, runs, workspaces } from "@/db/schema";
import { BRAND_KIND, PITCH_TTL_MS } from "@/lib/brand-kind";
import { formatWeekOf } from "@/lib/friday";
import { scheduledEngineStatus } from "@/lib/engines";
import { generatePromptPack, isBrandedPrompt, promptIntent } from "@/lib/prompts";
import { resolveRunEngines } from "@/lib/plan-engines";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getAppContext } from "@/lib/session";
import { splitNames } from "@/lib/split";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

function parseDomain(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  try {
    const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProto);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || !host.includes(".")) return null;
    const slug = host.split(".")[0] || host;
    const name = slug.charAt(0).toUpperCase() + slug.slice(1);
    return { host, siteUrl: `https://${host}`, name };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.runCreate, ctx.workspace.id);
  if (limited) return limited;

  const body = (await request.json().catch(() => ({}))) as Record<string, string | undefined>;
  const parsed = parseDomain(body.domain || body.siteUrl || "");
  if (!parsed) return jsonError("Enter a domain like acme.com.");

  const now = new Date();
  const [openPitch] = await ctx.db
    .select({ id: brands.id })
    .from(brands)
    .where(
      and(
        eq(brands.workspaceId, ctx.workspace.id),
        eq(brands.kind, BRAND_KIND.pitch),
        isNull(brands.archivedAt),
        or(isNull(brands.expiresAt), gt(brands.expiresAt, now)),
      ),
    )
    .limit(1);
  if (openPitch) {
    return jsonError("You already have an open pitch. Convert it or wait for it to expire.", 409, {
      code: "pitch_open",
      brandId: openPitch.id,
    });
  }

  const name = body.name?.trim() || parsed.name;
  const competitorNames = splitNames(body.competitors);
  const brandId = crypto.randomUUID();
  const expiresAt = new Date(now.getTime() + PITCH_TTL_MS);

  await ctx.db.insert(brands).values({
    id: brandId,
    workspaceId: ctx.workspace.id,
    name,
    siteUrl: parsed.siteUrl,
    market: body.market?.trim() || "US",
    category: body.category?.trim() || "software",
    buyer: body.buyer?.trim() || "buyers",
    incumbent: competitorNames[0] || null,
    kind: BRAND_KIND.pitch,
    expiresAt,
    createdAt: now,
    updatedAt: now,
  });

  if (competitorNames.length) {
    await ctx.db.insert(competitors).values(
      competitorNames.map((competitorName) => ({
        id: crypto.randomUUID(),
        brandId,
        name: competitorName,
        createdAt: now,
      })),
    );
  }

  const pack = generatePromptPack(
    {
      brand: name,
      category: body.category?.trim() || "software",
      buyer: body.buyer?.trim() || "buyers",
      market: body.market?.trim() || "US",
      incumbent: competitorNames[0] || "the incumbent",
      competitors: competitorNames,
    },
    { count: 20 },
  );
  await ctx.db.insert(prompts).values(
    pack.map((draft, index) => ({
      id: crypto.randomUUID(),
      brandId,
      text: draft.text,
      mix: draft.mix,
      intent: promptIntent(draft.text, draft.mix),
      branded: isBrandedPrompt(draft.text, name),
      sortOrder: index + 1,
      createdAt: now,
      updatedAt: now,
    })),
  );

  const [workspaceRow] = await ctx.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspace.id))
    .limit(1);
  const resolved = await resolveRunEngines({
    db: ctx.db,
    workspaceId: ctx.workspace.id,
    defaultEngines: workspaceRow?.defaultEngines,
    env,
  });
  const runId = crypto.randomUUID();
  const engineStates = scheduledEngineStatus(resolved.engines.map((engine) => engine.id));
  await ctx.db.insert(runs).values({
    id: runId,
    brandId,
    status: "queued",
    periodStart: formatWeekOf(now),
    periodEnd: formatWeekOf(now),
    engineStates: JSON.stringify(engineStates),
    createdAt: now,
  });

  if (env.RUNS_QUEUE) {
    try {
      await env.RUNS_QUEUE.send({
        runId,
        brandId,
        workspaceId: ctx.workspace.id,
        notifyEmail: ctx.user.email,
        queuedAt: now.toISOString(),
      });
    } catch (error) {
      console.error("[pitches] enqueue failed", runId, error);
      await ctx.db.update(runs).set({ status: "failed", completedAt: new Date() }).where(eq(runs.id, runId));
      return jsonError("Could not queue the pitch run.", 502);
    }
  }

  return jsonOk({ id: brandId, runId, expiresAt: expiresAt.toISOString() }, 201);
}
