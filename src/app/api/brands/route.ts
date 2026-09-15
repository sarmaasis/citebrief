import { getAppContext } from "@/lib/session";
import { assertBrandCap, capDenialFromError } from "@/lib/usage";
import { splitNames } from "@/lib/split";
import { jsonError, jsonOk } from "@/server/json";
import { LIST_PAGE_SIZE, listWorkspaceBrands, listWorkspaceBrandsPage, parseListPage } from "@/server/workspace-data";
import { brands, competitors } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const url = new URL(request.url);
  const includeArchived = url.searchParams.get("archived") === "1";
  const pageRaw = url.searchParams.get("page");
  if (!pageRaw) {
    const rows = await listWorkspaceBrands(ctx, includeArchived);
    return jsonOk({ brands: rows });
  }
  const limitRaw = Number.parseInt(url.searchParams.get("limit") || "", 10);
  const pageSize = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : LIST_PAGE_SIZE;
  const { page } = parseListPage(pageRaw, pageSize);
  const paged = await listWorkspaceBrandsPage(ctx, { includeArchived, page, pageSize });
  return jsonOk({ brands: paged.rows, total: paged.total, page: paged.page, pageSize: paged.pageSize });
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
    const denial = capDenialFromError(error);
    return jsonError(error instanceof Error ? error.message : "Brand cap reached.", 402, {
      code: denial?.code ?? "brand_cap",
    });
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
    market: body.market?.trim() || "US",
    category: body.category?.trim() || null,
    buyer: body.buyer?.trim() || null,
    job: body.job?.trim() || null,
    incumbent: body.incumbent?.trim() || null,
    constraintNote: body.constraintNote?.trim() || null,
    clientOwner: body.clientOwner?.trim() || null,
    clientNotes: body.clientNotes?.trim() || null,
    kind: "client",
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
