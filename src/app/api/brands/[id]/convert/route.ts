import { eq } from "drizzle-orm";
import { brands } from "@/db/schema";
import { isPitchBrand, isPitchExpired } from "@/lib/brand-kind";
import { getAppContext } from "@/lib/session";
import { assertBrandCap, capDenialFromError } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { getWorkspaceBrand } from "@/server/workspace-data";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) return jsonError("Brand not found.", 404);
  if (!isPitchBrand(brand.kind)) return jsonError("Only pitch audits can convert.");
  if (isPitchExpired(brand.expiresAt)) {
    return jsonError("This pitch expired. Start a new one.");
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
  await ctx.db
    .update(brands)
    .set({ kind: "client", expiresAt: null, updatedAt: now })
    .where(eq(brands.id, id));

  return jsonOk({ id, kind: "client" });
}
