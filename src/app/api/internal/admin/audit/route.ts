import { desc, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auditLogs } from "@/db/schema";
import { getDb } from "@/db";
import { guardInternalRoute } from "@/lib/internal-guard";
import { jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await guardInternalRoute(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;

  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId")?.trim();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || "40") || 40));
  const db = await getDb();
  const rows = workspaceId
    ? await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.workspaceId, workspaceId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(limit)
    : await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);

  return jsonOk({
    ok: true,
    logs: rows.map((row) => ({
      id: row.id,
      action: row.action,
      workspaceId: row.workspaceId,
      actorEmail: row.actorEmail,
      targetType: row.targetType,
      targetId: row.targetId,
      ip: row.ip,
      createdAt: row.createdAt,
      metadata: row.metadata,
    })),
  });
}
