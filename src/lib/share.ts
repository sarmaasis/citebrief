import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { reports } from "@/db/schema";

export const SHARE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export type ShareAccess = "live" | "missing" | "expired" | "revoked";

export function shareAccessState(report: {
  shareToken?: string | null;
  shareExpiresAt?: Date | null;
  shareRevokedAt?: Date | null;
}): ShareAccess {
  if (!report.shareToken) return "missing";
  if (report.shareRevokedAt) return "revoked";
  if (report.shareExpiresAt && new Date(report.shareExpiresAt).getTime() < Date.now()) return "expired";
  return "live";
}

export function isShareLive(report: {
  shareToken?: string | null;
  shareExpiresAt?: Date | null;
  shareRevokedAt?: Date | null;
}) {
  return shareAccessState(report) === "live";
}

export async function recordClientLinkOpen(db: Database, reportId: string) {
  await db
    .update(reports)
    .set({
      shareOpenCount: sql`${reports.shareOpenCount} + 1`,
      shareLastOpenedAt: new Date(),
    })
    .where(eq(reports.id, reportId));
}

export async function revokeClientLink(db: Database, reportId: string) {
  await db.update(reports).set({ shareRevokedAt: new Date() }).where(eq(reports.id, reportId));
}

export async function rotateClientLink(db: Database, reportId: string) {
  const token = crypto.randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + SHARE_TTL_MS);
  await db
    .update(reports)
    .set({
      shareToken: token,
      shareExpiresAt: expiresAt,
      shareRevokedAt: null,
      shareOpenCount: 0,
      shareLastOpenedAt: null,
    })
    .where(eq(reports.id, reportId));
  return { token, expiresAt };
}
