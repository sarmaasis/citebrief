import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { workspaces } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { PLANS } from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
import { requireSettingsAccess } from "@/lib/permissions";
import {
  CUSTOM_DOMAIN_DNS_STEPS,
  SYSTEM_DOMAIN_OPS_STEPS,
  SYSTEM_SENDER_DOMAIN,
  allSenderDomainChecksOk,
  buildSenderDomainSnapshot,
  checksFromWorkspace,
  isAllowedCustomSenderDomain,
  normalizeSenderDomain,
} from "@/lib/sender-domain";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

async function emailFromEnv(): Promise<string | undefined> {
  const { env } = await getCloudflareContext({ async: true });
  return env.CF_EMAIL_FROM;
}

export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const [workspace] = await ctx.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspace.id))
    .limit(1);
  if (!workspace) return jsonError("Workspace not found.", 404);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const checks = checksFromWorkspace(workspace);
  const domain = buildSenderDomainSnapshot({
    allowsCustomSender: ent.allowsCustomSender,
    senderName: workspace.senderName,
    senderDomain: workspace.senderDomain,
    checks,
    verifiedAt: workspace.senderDomainVerifiedAt,
    systemFrom: await emailFromEnv(),
  });
  return jsonOk({
    domain,
    dnsSteps: CUSTOM_DOMAIN_DNS_STEPS,
    systemOpsSteps: SYSTEM_DOMAIN_OPS_STEPS,
    systemDomain: SYSTEM_SENDER_DOMAIN,
    role: ctx.role,
    canEdit: ctx.impersonating || ctx.role === "owner" || ctx.role === "admin",
  });
}

export async function PUT(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireSettingsAccess(ctx);
  if (denied) return denied;

  const body = (await request.json()) as {
    senderName?: string;
    senderDomain?: string | null;
    checks?: {
      spfOk?: boolean;
      dkimOk?: boolean;
      dmarcOk?: boolean;
      cfOk?: boolean;
    };
  };

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);

  const [current] = await ctx.db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, ctx.workspace.id))
    .limit(1);
  if (!current) return jsonError("Workspace not found.", 404);

  if (!ent.allowsCustomSender) {
    return jsonError(`Custom sender domain requires ${PLANS.studio.name}.`, 403);
  }

  const senderName = body.senderName?.trim() || null;
  const nextDomain =
    body.senderDomain === undefined
      ? normalizeSenderDomain(current.senderDomain)
      : normalizeSenderDomain(body.senderDomain);
  const domainChanged = nextDomain !== normalizeSenderDomain(current.senderDomain);

  if (nextDomain && !isAllowedCustomSenderDomain(nextDomain)) {
    return jsonError(
      `Sender domain must be your hostname (not ${SYSTEM_SENDER_DOMAIN}). Example: reports.agency.com.`,
    );
  }

  const prevChecks = checksFromWorkspace(current);
  const checks = domainChanged
    ? { spfOk: false, dkimOk: false, dmarcOk: false, cfOk: false }
    : {
        spfOk: Boolean(body.checks?.spfOk ?? prevChecks.spfOk),
        dkimOk: Boolean(body.checks?.dkimOk ?? prevChecks.dkimOk),
        dmarcOk: Boolean(body.checks?.dmarcOk ?? prevChecks.dmarcOk),
        cfOk: Boolean(body.checks?.cfOk ?? prevChecks.cfOk),
      };

  if (!nextDomain && (checks.spfOk || checks.dkimOk || checks.dmarcOk || checks.cfOk)) {
    return jsonError("Save a sender domain before marking DNS checks complete.");
  }

  const verified = Boolean(nextDomain && allSenderDomainChecksOk(checks));
  const verifiedAt = verified
    ? current.senderDomainVerifiedAt && !domainChanged
      ? current.senderDomainVerifiedAt
      : new Date()
    : null;

  await ctx.db
    .update(workspaces)
    .set({
      senderName,
      senderDomain: nextDomain,
      senderDomainSpfOk: checks.spfOk,
      senderDomainDkimOk: checks.dkimOk,
      senderDomainDmarcOk: checks.dmarcOk,
      senderDomainCfOk: checks.cfOk,
      senderDomainVerifiedAt: verifiedAt,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, ctx.workspace.id));

  await writeAuditLog(ctx.db, {
    action: "workspace.domain.update",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "workspace",
    targetId: ctx.workspace.id,
    request,
    metadata: {
      senderDomain: nextDomain,
      verified,
      domainChanged,
      checks,
    },
  });

  const domain = buildSenderDomainSnapshot({
    allowsCustomSender: true,
    senderName,
    senderDomain: nextDomain,
    checks,
    verifiedAt,
    systemFrom: await emailFromEnv(),
  });

  return jsonOk({ ok: true, domain });
}
