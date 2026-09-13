import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { subscriptions } from "@/db/schema";
import { scheduleDodoCancelAtPeriodEnd } from "@/lib/dodo";
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
  const body = (await request.json().catch(() => ({}))) as { cancel?: boolean };
  const cancel = body.cancel !== false;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  if (!sub) return jsonError("No subscription found.", 404);

  const { env } = await getCloudflareContext({ async: true });
  const remote = await scheduleDodoCancelAtPeriodEnd({
    env,
    subscriptionId: sub.dodoSubscriptionId || "",
    cancel,
  });
  if (!remote.ok) return jsonError(remote.message || "Could not update cancellation.", 502);

  await ctx.db
    .update(subscriptions)
    .set({
      cancelAtPeriodEnd: cancel,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, sub.id));

  return jsonOk({
    ok: true,
    cancelAtPeriodEnd: cancel,
    stubbed: remote.stubbed,
    message: cancel
      ? "Cancellation scheduled at period end. PDFs stay for 90 days."
      : "Cancellation cleared. Subscription continues.",
  });
}
