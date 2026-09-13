import { desc, eq } from "drizzle-orm";
import { reports, runs } from "@/db/schema";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";
import { getWorkspaceBrand } from "@/server/workspace-data";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export async function GET(request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const { id } = await context.params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) return jsonError("Brand not found.", 404);

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsHistory) {
    return jsonError("History export requires Agency, Studio, or Enterprise.", 402);
  }

  const rows = await ctx.db
    .select({ report: reports, run: runs })
    .from(reports)
    .innerJoin(runs, eq(runs.id, reports.runId))
    .where(eq(reports.brandId, id))
    .orderBy(desc(reports.createdAt))
    .limit(52);

  const format = new URL(request.url).searchParams.get("format");
  if (format === "csv") {
    const header = [
      "period",
      "mentioned",
      "recommended",
      "total",
      "sent_at",
      "share_opens",
      "share_last_opened_at",
    ].join(",");
    const lines = rows.map(({ report, run }) =>
      [
        csvCell(run.periodStart),
        csvCell(report.scoreMentioned),
        csvCell(report.scoreRecommended),
        csvCell(report.scoreTotal),
        csvCell(report.sentAt?.toISOString() ?? null),
        csvCell(report.shareOpenCount),
        csvCell(report.shareLastOpenedAt?.toISOString() ?? null),
      ].join(","),
    );
    return new Response([header, ...lines].join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${brand.name.replace(/\s+/g, "-").toLowerCase()}-history.csv"`,
      },
    });
  }

  return jsonOk({
    brandId: id,
    reports: rows.map(({ report, run }) => ({
      id: report.id,
      period: run.periodStart,
      mentioned: report.scoreMentioned,
      recommended: report.scoreRecommended,
      total: report.scoreTotal,
      sentAt: report.sentAt,
      shareOpenCount: report.shareOpenCount,
      shareLastOpenedAt: report.shareLastOpenedAt,
    })),
  });
}
