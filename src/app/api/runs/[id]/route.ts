import { and, eq } from "drizzle-orm";
import { advanceEngineStub, parseEngineStatus } from "@/lib/engines";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";
import { brands, reports, runs } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;

  const [row] = await ctx.db
    .select({
      run: runs,
      workspaceId: brands.workspaceId,
    })
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .where(and(eq(runs.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);

  if (!row) {
    return jsonError("Run not found.", 404);
  }

  let status = row.run.status;
  let engines = parseEngineStatus(row.run.engineStates);
  let reportId: string | null = null;

  if (status !== "complete" && status !== "failed") {
    const createdAt = row.run.createdAt instanceof Date ? row.run.createdAt : new Date(row.run.createdAt);
    const next = advanceEngineStub(createdAt);
    status = next.status;
    engines = next.engines;
    const completedAt = status === "complete" ? new Date() : null;
    await ctx.db
      .update(runs)
      .set({
        status,
        engineStates: JSON.stringify(engines),
        completedAt,
      })
      .where(eq(runs.id, id));

    if (status === "complete") {
      const [existing] = await ctx.db.select().from(reports).where(eq(reports.runId, id)).limit(1);
      if (existing) {
        reportId = existing.id;
      } else {
        reportId = crypto.randomUUID();
        await ctx.db.insert(reports).values({
          id: reportId,
          runId: id,
          brandId: row.run.brandId,
          scoreMentioned: null,
          scoreTotal: 20,
          createdAt: new Date(),
        });
      }
    }
  } else {
    const [existing] = await ctx.db.select().from(reports).where(eq(reports.runId, id)).limit(1);
    reportId = existing?.id ?? null;
  }

  return jsonOk({
    id,
    brandId: row.run.brandId,
    status,
    engines,
    periodStart: row.run.periodStart,
    completedAt: row.run.completedAt,
    reportId,
  });
}
