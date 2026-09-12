import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { workspaces } from "@/db/schema";
import { getDb } from "@/db";
import { actAsCookieName, buildActAsCookieValue } from "@/lib/admin-impersonate";
import { isStubSecret } from "@/lib/billing";
import { requireInternalSecret } from "@/lib/internal-auth";
import { jsonError } from "@/server/json";

export const dynamic = "force-dynamic";

function adminSecret(env: CloudflareEnv) {
  return env.INTERNAL_ADMIN_SECRET || (process.env.NODE_ENV === "development" ? "dev-admin" : "");
}

/** Support: set signed act-as cookie for a workspace (Bearer INTERNAL_ADMIN_SECRET). */
export async function POST(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = requireInternalSecret(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { workspaceId?: string };
  const workspaceId = body.workspaceId?.trim();
  if (!workspaceId) return jsonError("workspaceId is required.");

  const db = await getDb();
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!workspace) return jsonError("Workspace not found.", 404);

  const secret = adminSecret(env);
  if (!secret || (isStubSecret(secret) && secret !== "dev-admin")) {
    return jsonError("INTERNAL_ADMIN_SECRET must be set.", 503);
  }

  const value = await buildActAsCookieValue(workspaceId, secret);
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
  });
  return response;
}

export async function DELETE(request: Request) {
  const { env } = await getCloudflareContext({ async: true });
  const denied = requireInternalSecret(request, env, "INTERNAL_ADMIN_SECRET");
  if (denied) return denied;
  const response = NextResponse.json({ ok: true, cleared: true });
  response.cookies.set(actAsCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
