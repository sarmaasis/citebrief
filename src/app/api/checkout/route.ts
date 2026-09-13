import { eq } from "drizzle-orm";
import { parseBillingInterval, parsePlanId, TRIAL_DAYS } from "@/lib/billing";
import { createDodoCheckout } from "@/lib/dodo";
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
    return jsonError("Unknown plan. Use starter, agency, or studio.");
  }
  const interval = parseBillingInterval(url.searchParams.get("interval"));

  const { env } = await getCloudflareContext({ async: true });
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

  const [existing] = await ctx.db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.workspaceId, ctx.workspace.id))
    .limit(1);

  if (!existing) {
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    await ctx.db.insert(subscriptions).values({
      id: crypto.randomUUID(),
      workspaceId: ctx.workspace.id,
      plan,
      status: checkout.mode === "stub" ? "trialing" : "none",
      billingInterval: interval,
      trialEndsAt: trialEnds,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  } else if (checkout.mode === "stub") {
    await ctx.db
      .update(subscriptions)
      .set({
        plan,
        status: "trialing",
        billingInterval: interval,
        trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, existing.id));
  }

  if (url.searchParams.get("redirect") === "0") {
    return jsonOk({ plan, interval, ...checkout });
  }

  return Response.redirect(checkout.url, 302);
}
