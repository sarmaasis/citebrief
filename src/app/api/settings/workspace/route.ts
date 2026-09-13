import { eq } from "drizzle-orm";
import { workspaces } from "@/db/schema";
import { isValidSenderDomain } from "@/lib/email";
import { workspaceEntitlements } from "@/lib/entitlements";
import { writeAuditLog } from "@/lib/audit";
import { clampMinutesSaved } from "@/lib/command-center";
import { isValidIanaTimeZone } from "@/lib/friday-tz";
import { validateDefaultEngines } from "@/lib/plan-engines";
import { requireSettingsAccess } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

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
  return jsonOk({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      timezone: workspace.timezone,
      senderName: workspace.senderName,
      senderDomain: workspace.senderDomain,
      defaultEngines: workspace.defaultEngines,
      slackWebhookUrl: workspace.slackWebhookUrl,
      minutesSavedPerReport: clampMinutesSaved(workspace.minutesSavedPerReport),
    },
    entitlements: {
      allowsSlack: ent.allowsSlack,
      allowsCustomSender: ent.allowsCustomSender,
      allowsStudioEngines: ent.allowsStudioEngines,
    },
    role: ctx.role,
  });
}

export async function PUT(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireSettingsAccess(ctx);
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    timezone?: string;
    senderName?: string;
    senderDomain?: string;
    defaultEngines?: string;
    slackWebhookUrl?: string | null;
    minutesSavedPerReport?: number;
  };
  const name = body.name?.trim();
  if (!name) return jsonError("Workspace name is required.");

  const timezone = body.timezone?.trim() || "America/New_York";
  if (!isValidIanaTimeZone(timezone)) {
    return jsonError("Use a valid IANA timezone such as America/New_York.");
  }

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);

  const slackWebhookUrl = body.slackWebhookUrl?.trim() || null;
  const senderName = body.senderName?.trim() || null;
  const senderDomain = body.senderDomain?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null;

  if (senderName && senderName !== "CiteBrief" && !ent.allowsCustomSender) {
    return jsonError("Custom sender requires Studio.", 403);
  }
  if (senderDomain) {
    if (!ent.allowsCustomSender) {
      return jsonError("Custom sender domain requires Studio.", 403);
    }
    if (!isValidSenderDomain(senderDomain)) {
      return jsonError("Sender domain must be a hostname such as reports.agency.com.");
    }
  }
  if (slackWebhookUrl && !ent.allowsSlack) {
    return jsonError("Slack webhook requires Agency, Studio, or Enterprise.", 402);
  }
  if (slackWebhookUrl && !slackWebhookUrl.startsWith("https://hooks.slack.com/")) {
    return jsonError("Use a Slack incoming webhook URL (https://hooks.slack.com/...).");
  }

  const engines = validateDefaultEngines(body.defaultEngines, ent.allowsStudioEngines);
  if (!engines.ok) return jsonError(engines.error);

  await ctx.db
    .update(workspaces)
    .set({
      name,
      timezone,
      senderName: ent.allowsCustomSender ? senderName : null,
      senderDomain: ent.allowsCustomSender ? senderDomain : null,
      defaultEngines: engines.normalized,
      slackWebhookUrl,
      minutesSavedPerReport: clampMinutesSaved(body.minutesSavedPerReport),
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, ctx.workspace.id));

  await writeAuditLog(ctx.db, {
    action: "workspace.update",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "workspace",
    targetId: ctx.workspace.id,
    request,
    metadata: { timezone, senderDomain: Boolean(senderDomain), slack: Boolean(slackWebhookUrl) },
  });

  return jsonOk({ ok: true });
}
