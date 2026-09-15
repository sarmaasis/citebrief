import { eq } from "drizzle-orm";
import {
  ENTERPRISE_CONTACT_SALES_MESSAGE,
  parseBillingInterval,
  parsePlanId,
  selfServeEnterpriseCheckoutDenied,
  shouldWriteStubPaidSubscription,
  stubPaidSubscriptionPatch,
} from "@/lib/billing";
import { createDodoCheckout } from "@/lib/dodo";
import { isPaidActive, workspaceEntitlements } from "@/lib/entitlements";
import { topUpWorkspaceBrandPrompts } from "@/lib/prompt-topup";
import { isProductionRuntime } from "@/lib/runtime-env";
import { writeAuditLog } from "@/lib/audit";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireOwner } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { planChangeMeteringPatch, countMonthlyRechecksUsed } from "@/lib/usage";
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

  const [existing] = await ctx.db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, ctx.workspace.id))
    .limit(1);

  const enterpriseDenied = selfServeEnterpriseCheckoutDenied({
    plan,
    impersonating: Boolean(ctx.impersonating),
    alreadyEnterprise: Boolean(
      existing && existing.plan === "enterprise" && isPaidActive(existing),
    ),
  });
  if (enterpriseDenied) {
    return jsonError(enterpriseDenied, 403);
  }

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
    return jsonError(checkout.message, plan === "enterprise" ? 403 : 503);
  }
  if (checkout.mode === "stub" && (isProductionRuntime(env) || plan === "enterprise")) {
    return jsonError(plan === "enterprise" ? ENTERPRISE_CONTACT_SALES_MESSAGE : "Billing is not configured.", plan === "enterprise" ? 403 : 503);
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

  const persistStubPaid = shouldWriteStubPaidSubscription({
    mode: checkout.mode,
    isProduction: isProductionRuntime(env),
    plan,
  });

  if (persistStubPaid) {
    const prevPromptCap = workspaceEntitlements(existing).promptCap;
    const patch = stubPaidSubscriptionPatch({ plan, interval });
    const planChanging = Boolean(existing && existing.plan !== plan);
    let monthlyRechecksUsed: number | undefined;
    let extraRunCredits: number | undefined;
    if (planChanging && existing) {
      monthlyRechecksUsed = await countMonthlyRechecksUsed(
        ctx.db,
        ctx.workspace.id,
        existing.plan,
        existing.planMeteringSince ?? null,
      );
      extraRunCredits = existing.extraRunCredits || 0;
    }
    const metering = planChangeMeteringPatch({
      previousPlan: existing?.plan,
      nextPlan: plan,
      monthlyRechecksUsed,
      extraRunCredits,
    });
    if (!existing) {
      await ctx.db.insert(subscriptions).values({
        id: crypto.randomUUID(),
        workspaceId: ctx.workspace.id,
        ...patch,
        ...(metering ?? { planMeteringSince: new Date(), extraRuns: 0 }),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } else {
      await ctx.db
        .update(subscriptions)
        .set({
          ...patch,
          ...(metering ?? {}),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, existing.id));
    }
    const nextPromptCap = workspaceEntitlements({
      ...existing,
      ...patch,
      trialEndsAt: patch.trialEndsAt,
    }).promptCap;
    if (nextPromptCap > prevPromptCap) {
      try {
        await topUpWorkspaceBrandPrompts(ctx.db, ctx.workspace.id, nextPromptCap);
      } catch (error) {
        console.info("[checkout] prompt top-up failed", error);
      }
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
