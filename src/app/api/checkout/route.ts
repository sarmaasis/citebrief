import { eq } from "drizzle-orm";
import { parseBillingInterval, parsePlanId, shouldWriteStubPaidSubscription, stubPaidSubscriptionPatch } from "@/lib/billing";
import { createDodoCheckout } from "@/lib/dodo";
import { isProductionRuntime } from "@/lib/runtime-env";
import { writeAuditLog } from "@/lib/audit";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireOwner } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { subscriptions } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const denied = requireOwner(ctx, "Only the workspace owner can start checkout.");
  if (denied) return denied;

  const url = new URL(request.url);
  const plan = parsePlanId(url.searchParams.get("plan") || "agency");
  if (!plan) {
    return jsonError("Unknown plan. Use starter, agency, studio, or enterprise.");
  }
  const interval = parseBillingInterval(url.searchParams.get("interval"));

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.billing, ctx.workspace.id);
  if (limited) return limited;
  const origin = env.BETTER_AUTH_URL || url.origin;
  const checkout = await createDodoCheckout({
    env,
    plan,
    interval,
    workspaceId: ctx.workspace.id,
    customerEmail: ctx.user.email,
    customerName: ctx.user.name,
    returnUrl: origin.replace(/\/$/, ""),
  });

  if (checkout.mode === "unavailable") {
    return jsonError(checkout.message, 503);
  }
  if (checkout.mode === "stub" && isProductionRuntime(env)) {
    return jsonError("Billing is not configured.", 503);
  }

  await writeAuditLog(ctx.db, {
    action: "billing.checkout",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "plan",
    targetId: plan,
    request,
    metadata: { interval, mode: checkout.mode },
  });

  const [existing] = await ctx.db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, ctx.workspace.id))
    .limit(1);

  const persistStubPaid = shouldWriteStubPaidSubscription({
    mode: checkout.mode,
    isProduction: isProductionRuntime(env),
  });

  if (persistStubPaid) {
    const patch = stubPaidSubscriptionPatch({ plan, interval });
    if (!existing) {
      await ctx.db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        workspaceId: ctx.workspace.id,
        ...patch,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      await ctx.db
        .update(subscriptions)
        .set({
          ...patch,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id));
    }
  } else if (!existing && checkout.mode === "redirect") {
    await ctx.db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      workspaceId: ctx.workspace.id,
      plan,
      status: "none",
      billingInterval: interval,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  if (url.searchParams.get("redirect") === "0") {
    return jsonOk({
      ...checkout,
      plan,
      interval,
      paid: persistStubPaid,
      status: persistStubPaid ? "active" : existing?.status ?? "none",
    });
  }

  return Response.redirect(checkout.url, 302);
}
