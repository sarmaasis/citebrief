import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { brands, subscriptions, workspaces } from "@/db/schema";
import { getDb } from "@/db";
import { workspaceEntitlements } from "@/lib/entitlements";
import { requireInternalSecret } from "@/lib/internal-auth";
import { jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/** Internal: plan usage by workspace. */
export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = requireInternalSecret(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;

  const db = await getDb();
  const workspaceRows = await db.select().from(workspaces);
  const usage = [];
  for (const workspace of workspaceRows) {
    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.workspaceId, workspace.id))
      .limit(1);
    const ent = workspaceEntitlements(sub ?? null);
    const brandRows = await db.select().from(brands).where(eq(brands.workspaceId, workspace.id));
    const activeBrands = brandRows.filter((row) => !row.archivedAt);
    usage.push({
      workspaceId: workspace.id,
      name: workspace.name,
      plan: ent.plan,
      status: sub?.status || "none",
      paid: ent.paid,
      trialing: ent.trialing,
      brandsUsed: activeBrands.length,
      brandLimit: ent.brandLimit,
      extraBrands: ent.extraBrands,
      extraSeats: ent.extraSeats,
      runsUsed: sub?.runsUsed || 0,
      extraRuns: sub?.extraRuns || 0,
    });
  }
  return jsonOk({ workspaces: usage });
}
