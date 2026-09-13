import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db";
import { reports } from "@/db/schema";

export async function recordClientLinkOpen(db: Database, reportId: string) {
  await db
    .update(reports)
    .set({
      shareOpenCount: sql`${reports.shareOpenCount} + 1`,
      shareLastOpenedAt: new Date(),
    })
    .where(eq(reports.id, reportId));
}
