import { getCloudflareContext } from "@opennextjs/cloudflare";
import { writeAuditLog } from "@/lib/audit";
import { deletionOwnerEmail, deletionSupportEmail } from "@/emails";
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

  const support = deletionSupportEmail({
    ownerEmail: ctx.user.email,
    workspaceId: ctx.workspace.id,
    workspaceName: ctx.workspace.name,
  });
  const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "");
  const owner = deletionOwnerEmail({
    workspaceName: ctx.workspace.name,
    settingsUrl: origin ? `${origin}/app/settings/workspace` : undefined,
  });
  await sendTransactionalEmail({
    env,
    to: "support@getcitebrief.com",
    subject: support.subject,
    html: support.html,
    text: support.text,
  });
  await sendTransactionalEmail({
    env,
    to: ctx.user.email,
    subject: owner.subject,
    html: owner.html,
    text: owner.text,
  });

  return jsonOk({
    ok: true,
    message: "Deletion request sent. We will confirm at your owner email when the workspace is removed.",
  });
}
