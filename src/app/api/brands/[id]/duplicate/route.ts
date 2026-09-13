import { brands, competitors, prompts } from "@/db/schema";
import { assertBrandCap } from "@/lib/usage";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";
import { getBrandBundle, getWorkspaceBrand } from "@/server/workspace-data";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const source = await getWorkspaceBrand(ctx, id);
  if (!source) return jsonError("Brand not found.", 404);

  try {
    await assertBrandCap(ctx.db, ctx.workspace.id);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Brand cap reached.", 402);
  }

  const bundle = await getBrandBundle(ctx, id);
  if (!bundle) return jsonError("Brand not found.", 404);

  const now = new Date();
  const newId = crypto.randomUUID();
  await ctx.db.insert(brands).values({
    id: newId,
    workspaceId: ctx.workspace.id,
    name: `${source.name} copy`,
    siteUrl: source.siteUrl,
    logoUrl: source.logoUrl,
    vertical: source.vertical,
    category: source.category,
    buyer: source.buyer,
    job: source.job,
    incumbent: source.incumbent,
    constraintNote: source.constraintNote,
    clientOwner: source.clientOwner,
    createdAt: now,
    updatedAt: now,
  });

  if (bundle.competitors.length) {
    await ctx.db.insert(competitors).values(
      bundle.competitors.map((row) => ({
        id: crypto.randomUUID(),
        brandId: newId,
        name: row.name,
        createdAt: now,
      })),
    );
  }

  if (bundle.prompts.length) {
    await ctx.db.insert(prompts).values(
      bundle.prompts.map((row) => ({
        id: crypto.randomUUID(),
        brandId: newId,
        text: row.text,
        mix: row.mix,
        sortOrder: row.sortOrder,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  return jsonOk({ id: newId }, 201);
}
