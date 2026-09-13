import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { workspaces } from "@/db/schema";
import { getDb } from "@/db";
import { actAsCookieName, buildActAsCookieValue } from "@/lib/admin-impersonate";
import { writeAuditLog } from "@/lib/audit";
import { guardInternalRoute } from "@/lib/internal-guard";
import { isForbiddenProductionSecret, isProductionRuntime } from "@/lib/runtime-env";
import { jsonError } from "@/server/json";

export const dynamic = "force-dynamic";

function cookieSecret(env: CloudflareEnv) {
  const configured = env.INTERNAL_ADMIN_SECRET?.trim();
  if (configured && !isForbiddenProductionSecret(configured)) return configured;
  if (!isProductionRuntime(env)) return "dev-admin";
  return "";
}

/** Support: set signed act-as cookie for a workspace (Bearer INTERNAL_ADMIN_SECRET). */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await guardInternalRoute(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) return jsonError("workspaceId is required.");

  const db = await getDb();
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!workspace) return jsonError("Workspace not found.", 404);

  const secret = cookieSecret(env);
  if (!secret) {
    return jsonError("INTERNAL_ADMIN_SECRET must be set.", 503);
  }

  const value = await buildActAsCookieValue(workspaceId, secret);
  await writeAuditLog(db, {
    action: "impersonation.start",
    workspaceId,
    targetType: "workspace",
    targetId: workspaceId,
    request,
    metadata: { name: workspace.name },
  });
  const response = NextResponse.json({
    ok: true,
    workspaceId,
    name: workspace.name,
    message: "Act-as cookie set for 1 hour. API calls may also send X-CiteBrief-Act-As-Workspace with Bearer admin secret.",
  });
  response.cookies.set(actAsCookieName(), value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
    secure: isProductionRuntime(env),
  });
  return response;
}

export async function DELETE(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = await guardInternalRoute(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;
  const db = await getDb();
  await writeAuditLog(db, {
    action: "impersonation.end",
    request,
  });
  const response = NextResponse.json({ ok: true, cleared: true });
  response.cookies.set(actAsCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: isProductionRuntime(env),
  });
  return response;
}
