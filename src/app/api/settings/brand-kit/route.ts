import { eq } from "drizzle-orm";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";
import { brandKits } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const body = (await request.json()) as {
    logoUrl?: string;
    accentColor?: string;
    footerText?: string;
    preparedBy?: string;
  };

  const accent = (body.accentColor || "#0B3D2E").trim();
  if (/purple|gradient|#6d28d9|#7c3aed|#8b5cf6/i.test(accent)) {
    return jsonError("Accent must stay paper and ink. No purple.");
  }

  const now = new Date();
  const [existing] = await ctx.db
    .select()
    .from(brandKits)
    .where(eq(brandKits.workspaceId, ctx.workspace.id))
    .limit(1);

  if (existing) {
    await ctx.db
      .update(brandKits)
      .set({
        logoUrl: body.logoUrl?.trim() || null,
        accentColor: accent || "#0B3D2E",
        footerText: body.footerText?.trim() || null,
        preparedBy: body.preparedBy?.trim() || null,
        updatedAt: now,
      })
      .where(eq(brandKits.id, existing.id));
  } else {
    await ctx.db.insert(brandKits).values({
      id: crypto.randomUUID(),
      workspaceId: ctx.workspace.id,
      logoUrl: body.logoUrl?.trim() || null,
      accentColor: accent || "#0B3D2E",
      footerText: body.footerText?.trim() || null,
      preparedBy: body.preparedBy?.trim() || null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return jsonOk({ ok: true });
}
