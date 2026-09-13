import { getAppContext } from "@/lib/session";
import { getUsageSnapshot } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

/** Included vs billable usage before charges happen (PRODUCT §18.4). */
export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const usage = await getUsageSnapshot(ctx.db, ctx.workspace.id);
  return jsonOk({ usage, role: ctx.role });
}
