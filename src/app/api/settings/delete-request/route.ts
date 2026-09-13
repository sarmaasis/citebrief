import { getCloudflareContext } from "@opennextjs/cloudflare";
import { writeAuditLog } from "@/lib/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { requireOwner } from "@/lib/permissions";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireOwner(ctx, "Only the workspace owner can request account deletion.");
  if (denied) return denied;

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.export, ctx.workspace.id);
  if (limited) return limited;

  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm?.trim().toLowerCase() !== "delete") {
    return jsonError("Type delete to confirm the deletion request.");
  }

  await writeAuditLog(ctx.db, {
    action: "account.delete_request",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "workspace",
    targetId: ctx.workspace.id,
    request,
  });

  await sendTransactionalEmail({
    env,
    to: "support@getcitebrief.com",
    subject: `Deletion request: ${ctx.workspace.name}`,
    html: `<p>${ctx.user.email} requested deletion of workspace ${ctx.workspace.id} (${ctx.workspace.name}).</p>`,
  });

  await sendTransactionalEmail({
    env,
    to: ctx.user.email,
    subject: "CiteBrief deletion request received",
    html: `<p>We received your request to delete ${ctx.workspace.name}. Support will confirm once workspace data is removed. Export a copy first from Settings if you still need it.</p>`,
  });

  return jsonOk({
    ok: true,
    message: "Deletion request sent. We will confirm at your owner email when the workspace is removed.",
  });
}
