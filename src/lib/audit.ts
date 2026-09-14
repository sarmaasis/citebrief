import type { Database } from "@/db";
import { auditLogs } from "@/db/schema";
import { clientIp } from "@/lib/runtime-env";

export type AuditAction =
  | "impersonation.start"
  | "impersonation.end"
  | "webhook.replay"
  | "report.send"
  | "report.approve"
  | "report.bulk_approve"
  | "report.email_draft"
  | "opportunity.planned"
  | "opportunity.completed"
  | "opportunity.dismissed"
  | "opportunity.status"
  | "report.share_revoke"
  | "report.share_rotate"
  | "billing.checkout"
  | "billing.portal"
  | "billing.cancel"
  | "billing.addon"
  | "invite.create"
  | "invite.revoke"
  | "member.remove"
  | "workspace.update"
  | "brand.archive"
  | "brand.unarchive"
  | "data.export"
  | "account.delete_request";

export async function writeAuditLog(
  db: Database,
  entry: {
    action: AuditAction;
    workspaceId?: string | null;
    actorUserId?: string | null;
    actorEmail?: string | null;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: Record<string, unknown> | null;
    ip?: string | null;
    request?: Request;
  },
): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      workspaceId: entry.workspaceId ?? null,
      actorUserId: entry.actorUserId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      targetType: entry.targetType ?? null,
      targetId: entry.targetId ?? null,
      metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      ip: entry.ip ?? (entry.request ? clientIp(entry.request) : null),
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("[audit] write failed", entry.action, error);
  }
}
