import { getCloudflareContext } from "@opennextjs/cloudflare";
import { and, eq } from "drizzle-orm";
import { getReportObject } from "@/lib/r2";
import { getAppContext } from "@/lib/session";
import { pdfRetentionExpired } from "@/lib/entitlements";
import { getWorkspaceSubscription } from "@/lib/usage";
import { brands, reports } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return new Response("Sign in required.", { status: 401 });
  }
  const { id } = await context.params;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "html" ? "html" : "pdf";

  const [row] = await ctx.db
    .select({ report: reports, workspaceId: brands.workspaceId, brandName: brands.name })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .where(and(eq(reports.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);

  if (!row) {
    return new Response("Report not found.", { status: 404 });
  }

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  if (pdfRetentionExpired(sub)) {
    return new Response("This PDF is past the 90-day retention window.", { status: 410 });
  }

  const key = format === "html" ? row.report.htmlKey : row.report.r2Key;
  if (!key) {
    return new Response("Report file missing.", { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const bytes = await getReportObject(env, key);
  if (!bytes) {
    return new Response("Report file missing.", { status: 404 });
  }

  const filename = `${row.brandName.replace(/\s+/g, "-").toLowerCase()}-citebrief.${format === "html" ? "html" : "pdf"}`;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Response(copy, {
    headers: {
      "Content-Type": format === "html" ? "text/html; charset=utf-8" : "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
