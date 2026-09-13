import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { subscriptions } from "@/db/schema";
import { DODO_UNAVAILABLE_MESSAGE, scheduleDodoCancelAtPeriodEnd } from "@/lib/dodo";
import { writeAuditLog } from "@/lib/audit";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireOwner } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireOwner(ctx, "Only the workspace owner can change cancellation.");
  if (denied) return denied;
  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.billing, ctx.workspace.id);
  if (limited) return limited;
  const body = (await request.json().catch(() => ({}))) as { cancel?: boolean };
  const cancel = body.cancel !== false;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  if (!sub) return jsonError("No subscription found.", 404);

  const remote = await scheduleDodoCancelAtPeriodEnd({
    env,
    subscriptionId: sub.dodoSubscriptionId || "",
    cancel,
  });
  if (!remote.ok) {
    const status = remote.message === DODO_UNAVAILABLE_MESSAGE ? 503 : 502;
    return jsonError(remote.message || "Could not update cancellation.", status);
  }

  await ctx.db
    .update(subscriptions)
    .set({
      cancelAtPeriodEnd: cancel,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));

  await writeAuditLog(ctx.db, {
    action: "billing.cancel",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "subscription",
    targetId: sub.id,
    request,
    metadata: { cancel, stubbed: remote.stubbed },
  });

  return jsonOk({
    ok: true,
    cancelAtPeriodEnd: cancel,
    stubbed: remote.stubbed,
    message: cancel
      ? "Cancellation scheduled at period end. PDFs stay for 90 days."
      : "Cancellation cleared. Subscription continues.",
  });
}
