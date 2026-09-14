import { eq } from "drizzle-orm";
import { getAppContext } from "@/lib/session";
import { splitNames } from "@/lib/split";
import { writeAuditLog } from "@/lib/audit";
import { assertBrandCap } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { getBrandBundle, getWorkspaceBrand } from "@/server/workspace-data";
import { brands, competitors } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;
  const bundle = await getBrandBundle(ctx, id);
  if (!bundle) {
    return jsonError("Brand not found.", 404);
  }
  return jsonOk(bundle);
}

export async function PATCH(request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) {
    return jsonError("Brand not found.", 404);
  }

  const body = (await request.json()) as Record<string, string | undefined>;
  const name = body.name?.trim() || brand.name;
  if (!name) {
    return jsonError("Brand name is required.");
  }

  const now = new Date();
  const next: Partial<typeof brands.$inferInsert> = {
    name,
    updatedAt: now,
  };
  if (body.siteUrl !== undefined) next.siteUrl = body.siteUrl.trim() || null;
  if (body.logoUrl !== undefined) next.logoUrl = body.logoUrl.trim() || null;
  if (body.vertical !== undefined || body.category !== undefined) {
    next.vertical = (body.vertical ?? body.category)?.trim() || null;
  }
  if (body.category !== undefined) next.category = body.category.trim() || null;
  if (body.buyer !== undefined) next.buyer = body.buyer.trim() || null;
  if (body.job !== undefined) next.job = body.job.trim() || null;
  if (body.incumbent !== undefined) next.incumbent = body.incumbent.trim() || null;
  if (body.constraintNote !== undefined) next.constraintNote = body.constraintNote.trim() || null;
  if (body.clientOwner !== undefined) next.clientOwner = body.clientOwner.trim() || null;
  if (body.clientNotes !== undefined) next.clientNotes = body.clientNotes.trim() || null;
  if (body.archived === "0") {
    if (brand.archivedAt) {
      try {
        await assertBrandCap(ctx.db, ctx.workspace.id);
      } catch (error) {
        return jsonError(error instanceof Error ? error.message : "Brand cap reached.", 402);
      }
    }
    next.archivedAt = null;
  }
  if (body.archived === "1") next.archivedAt = now;

  await ctx.db.update(brands).set(next).where(eq(brands.id, id));

  if (body.archived === "1" || body.archived === "0") {
    await writeAuditLog(ctx.db, {
      action: body.archived === "1" ? "brand.archive" : "brand.unarchive",
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      targetType: "brand",
      targetId: id,
      request,
    });
  }

  if (typeof body.competitors === "string") {
    await ctx.db.delete(competitors).where(eq(competitors.brandId, id));
    const names = splitNames(body.competitors);
    if (names.length) {
      await ctx.db.insert(competitors).values(
        names.map((competitorName) => ({
          id: crypto.randomUUID(),
          brandId: id,
          name: competitorName,
          createdAt: now,
        })),
      );
    }
  }

  return jsonOk({ id });
}
