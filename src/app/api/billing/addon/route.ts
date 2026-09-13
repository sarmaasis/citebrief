import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createDodoAddonCheckout, type DodoAddon } from "@/lib/dodo";
import { workspaceEntitlements } from "@/lib/entitlements";
import { writeAuditLog } from "@/lib/audit";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requireOwner } from "@/lib/permissions";
import { bumpExtraBrands, bumpExtraRunCredits, bumpExtraSeats, getWorkspaceSubscription } from "@/lib/usage";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

function parseAddon(value: string | undefined): DodoAddon | null {
  if (value === "extra_run" || value === "extra_brand" || value === "extra_seat") return value;
  return null;
}

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireOwner(ctx, "Only the workspace owner can buy add-ons.");
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as { addon?: string };
  const addon = parseAddon(body.addon);
  if (!addon) return jsonError("addon must be extra_brand, extra_run, or extra_seat.");

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);

  if (addon === "extra_brand" && !ent.allowsExtraBrands) {
    return jsonError("Extra brands are available on Agency and Studio. Upgrade from Starter to add more brands.", 402);
  }
  if (addon === "extra_seat" && !ent.allowsExtraSeats) {
    return jsonError("Additional seats require Agency or Studio.", 402);
  }
  if (!ent.paid && addon !== "extra_run") {
    return jsonError("Start a paid plan before buying add-ons.", 402);
  }

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.billing, ctx.workspace.id);
  if (limited) return limited;
  const origin = (env.BETTER_AUTH_URL || "").replace(/\/$/, "") || "http://localhost:3000";
  const checkout = await createDodoAddonCheckout({
    env,
    workspaceId: ctx.workspace.id,
    customerEmail: ctx.user.email,
    customerName: ctx.user.name,
    returnUrl: origin,
    addon,
  });

  if (checkout.mode === "unavailable") {
    return jsonError(checkout.message, 503);
  }

  if (checkout.mode === "stub") {
    if (addon === "extra_brand") await bumpExtraBrands(ctx.db, ctx.workspace.id, 1);
    if (addon === "extra_seat") await bumpExtraSeats(ctx.db, ctx.workspace.id, 1);
    if (addon === "extra_run") await bumpExtraRunCredits(ctx.db, ctx.workspace.id, 1);
  }

  await writeAuditLog(ctx.db, {
    action: "billing.addon",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "addon",
    targetId: addon,
    request,
    metadata: { mode: checkout.mode },
  });

  return jsonOk({ addon, ...checkout });
}
