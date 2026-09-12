import { eq } from "drizzle-orm";
import { workspaces } from "@/db/schema";
import { planAllowsSlack } from "@/lib/billing";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const body = (await request.json()) as {
    name?: string;
    timezone?: string;
    senderName?: string;
    defaultEngines?: string;
    slackWebhookUrl?: string | null;
  };
  const name = body.name?.trim();
  if (!name) return jsonError("Workspace name is required.");

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  let slackWebhookUrl = body.slackWebhookUrl?.trim() || null;
  if (slackWebhookUrl && !planAllowsSlack(sub?.plan || "agency")) {
    return jsonError("Slack webhook requires Agency or Studio.", 402);
  }
  if (slackWebhookUrl && !slackWebhookUrl.startsWith("https://hooks.slack.com/")) {
    return jsonError("Use a Slack incoming webhook URL (https://hooks.slack.com/...).");
  }

  await ctx.db
    .update(workspaces)
    .set({
      name,
      timezone: body.timezone?.trim() || "America/New_York",
      senderName: body.senderName?.trim() || null,
      defaultEngines: body.defaultEngines?.trim() || null,
      slackWebhookUrl,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, ctx.workspace.id));

  return jsonOk({ ok: true });
}
