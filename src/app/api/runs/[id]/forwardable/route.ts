import { and, eq, isNull } from "drizzle-orm";
import { brands, runs } from "@/db/schema";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/** Store AM “would you forward page 1?” after first PDF. */
export async function POST(request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { forwardable?: unknown };
  if (typeof body.forwardable !== "boolean") {
    return jsonError("forwardable must be true or false.");
  }

  const [row] = await ctx.db
    .select({ id: runs.id, forwardable: runs.forwardable })
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .where(and(eq(runs.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return jsonError("Run not found.", 404);

  if (row.forwardable != null) {
    return jsonOk({ ok: true, alreadySet: true });
  }

  await ctx.db
    .update(runs)
    .set({ forwardable: body.forwardable })
    .where(and(eq(runs.id, id), isNull(runs.forwardable)));

  return jsonOk({ ok: true });
}
