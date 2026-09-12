import { getAppContext } from "@/lib/session";
import { assertBrandCap } from "@/lib/usage";
import { splitNames } from "@/lib/split";
import { jsonError, jsonOk } from "@/server/json";
import { listWorkspaceBrands } from "@/server/workspace-data";
import { brands, competitors } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
  const rows = await listWorkspaceBrands(ctx, includeArchived);
  return jsonOk({ brands: rows });
}

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }

  const body = (await request.json()) as Record<string, string | undefined>;
  const name = body.name?.trim();
  if (!name) {
    return jsonError("Brand name is required.");
  }

  try {
    await assertBrandCap(ctx.db, ctx.workspace.id);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Brand cap reached.", 402);
  }

  const now = new Date();
  const id = crypto.randomUUID();
  await ctx.db.insert(brands).values({
    id,
    workspaceId: ctx.workspace.id,
    name,
    siteUrl: body.siteUrl?.trim() || null,
    logoUrl: body.logoUrl?.trim() || null,
    vertical: body.vertical?.trim() || body.category?.trim() || null,
    category: body.category?.trim() || null,
    buyer: body.buyer?.trim() || null,
    job: body.job?.trim() || null,
    incumbent: body.incumbent?.trim() || null,
    constraintNote: body.constraintNote?.trim() || null,
    createdAt: now,
    updatedAt: now,
  });

  const competitorNames = splitNames(body.competitors);
  if (competitorNames.length) {
    await ctx.db.insert(competitors).values(
      competitorNames.map((competitorName) => ({
        id: crypto.randomUUID(),
        brandId: id,
        name: competitorName,
        createdAt: now,
      })),
    );
  }

  return jsonOk({ id }, 201);
}
