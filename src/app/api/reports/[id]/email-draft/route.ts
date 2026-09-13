import { and, eq } from "drizzle-orm";
import { brands, reports } from "@/db/schema";
import { writeAuditLog } from "@/lib/audit";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);

  const { id } = await context.params;
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsEmailSend) {
    return jsonError("Suggested client email is on Agency, Studio, and Enterprise.", 403);
  }

  const body = (await request.json().catch(() => ({}))) as { subject?: string; body?: string };
  const subject = body.subject?.trim();
  const emailBody = body.body?.trim();
  if (!subject || !emailBody) {
    return jsonError("subject and body are required.");
  }

  const [row] = await ctx.db
    .select({ report: reports })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .where(and(eq(reports.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!row) return jsonError("Report not found.", 404);

  await ctx.db
    .update(reports)
    .set({
      suggestedEmailSubject: subject.slice(0, 200),
      suggestedEmailBody: emailBody.slice(0, 4000),
    })
    .where(eq(reports.id, id));

  await writeAuditLog(ctx.db, {
    action: "report.email_draft",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "report",
    targetId: id,
  });

  return jsonOk({ ok: true, subject, body: emailBody });
}
