import { acceptInviteForUser } from "@/lib/workspace";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const body = (await request.json().catch(() => ({}))) as { token?: string };
  const token = body.token?.trim();
  if (!token) return jsonError("Invite token is required.");

  const result = await acceptInviteForUser(ctx.db, ctx.user, token);
  if (!result.ok) return jsonError(result.error, 400);
  return jsonOk({ ok: true, workspaceId: result.workspaceId, role: result.role });
}
