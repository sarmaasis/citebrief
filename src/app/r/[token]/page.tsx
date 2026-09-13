import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { cache } from "react";
import { getDb } from "@/db";
import { brandKits, brands, reports, runs, workspaces } from "@/db/schema";
import { getReportObject } from "@/lib/r2";
import { clientReportRobots } from "@/lib/seo";
import { recordClientLinkOpen, shareAccessState } from "@/lib/share";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const loadShare = cache(async (token: string) => {
  const db = await getDb();
  const [row] = await db
    .select({
      report: reports,
      brand: brands,
      run: runs,
      workspace: workspaces,
    })
    .from(reports)
    .innerJoin(brands, eq(brands.id, reports.brandId))
    .innerJoin(runs, eq(runs.id, reports.runId))
    .innerJoin(workspaces, eq(workspaces.id, brands.workspaceId))
    .where(eq(reports.shareToken, token))
    .limit(1);
  return row ?? null;
});

function shareUnavailableCopy(state: ReturnType<typeof shareAccessState>) {
  if (state === "revoked") {
    return {
      title: "This client link was revoked",
      body: "Ask your agency for a new client link.",
    };
  }
  if (state === "expired") {
    return {
      title: "This client link expired",
      body: "Ask your agency for a new one.",
    };
  }
  return {
    title: "Report not found",
    body: "Ask your agency for a new client link.",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const row = await loadShare(token);
  if (!row || shareAccessState(row.report) !== "live") {
    return {
      title: { absolute: "Client report" },
      robots: clientReportRobots,
    };
  }
  const description = row.report.summary?.trim().slice(0, 160) || undefined;
  return {
    title: { absolute: row.brand.name },
    description,
    robots: clientReportRobots,
  };
}

export default async function ClientSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let rateLimited = false;
  try {
    const { env } = await getCloudflareContext({ async: true });
    const hdrs = await headers();
    const limited = await consumeRouteRateLimit(
      new Request(`https://getcitebrief.com/r/${token}`, { headers: hdrs }),
      env,
      RATE_LIMITS.publicReport,
    );
    rateLimited = Boolean(limited);
  } catch {
    // Preview without KV still renders the report.
  }

  if (rateLimited) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Too many requests</h1>
        <p className="mt-3 text-sm text-cb-muted">Wait a minute and open the client link again.</p>
      </main>
    );
  }

  const row = await loadShare(token);
  const state = row ? shareAccessState(row.report) : "missing";

  if (!row || state !== "live") {
    const copy = shareUnavailableCopy(state);
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">{copy.title}</h1>
        <p className="mt-3 text-sm text-cb-muted">{copy.body}</p>
      </main>
    );
  }

  const db = await getDb();
  try {
    await recordClientLinkOpen(db, row.report.id);
  } catch {
    // Open tracking is best-effort and must not block the client page.
  }
  const [kit] = await db.select().from(brandKits).where(eq(brandKits.workspaceId, row.workspace.id)).limit(1);
  const accent = kit?.accentColor || "#0B3D2E";
  const preparedBy = kit?.preparedBy || row.report.agencyName || row.workspace.name;

  let html: string | null = null;
  if (row.report.htmlKey) {
    try {
      const { env } = await getCloudflareContext({ async: true });
      const bytes = await getReportObject(env, row.report.htmlKey);
      if (bytes) {
        html = new TextDecoder().decode(bytes);
      }
    } catch {
      html = null;
    }
  }

  return (
    <main className="min-h-screen bg-cb-bg">
      <header className="border-b border-cb-line bg-cb-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {kit?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={kit.logoUrl} alt="" className="h-6 object-contain" />
            ) : null}
            <div>
              <p className="text-sm font-medium" style={{ color: accent }}>
                {preparedBy}
              </p>
              <p className="text-xs text-cb-muted">
                {row.brand.name}
                {row.run.periodStart ? ` · Week of ${row.run.periodStart}` : ""}
              </p>
            </div>
          </div>
          <p className="font-mono text-sm tabular-nums" style={{ color: accent }}>
            {row.report.scoreMentioned ?? "-"}/{row.report.scoreTotal}
            {row.report.scoreRecommended != null ? ` · rec ${row.report.scoreRecommended}` : ""}
          </p>
        </div>
      </header>

      {row.run.status === "failed" ? (
        <div className="border-b border-cb-line bg-cb-pending-subtle px-6 py-3 text-center text-sm text-cb-pending">
          This week’s answers were incomplete. Ask your agency if you need a follow-up.
        </div>
      ) : null}

      <div className="mx-auto max-w-4xl px-6 py-8">
        {html ? (
          <iframe title="Client report" className="min-h-[80vh] w-full rounded-cb-card border border-cb-line bg-cb-surface" srcDoc={html} />
        ) : (
          <div className="rounded-cb-card border border-cb-line bg-cb-surface p-8">
            <p className="font-mono text-[28px] tabular-nums" style={{ color: accent }}>
              {row.report.scoreMentioned ?? "-"}/{row.report.scoreTotal}
            </p>
            <p className="mt-4 text-sm text-cb-text">{row.report.summary}</p>
            {kit?.footerText ? <p className="mt-8 text-xs text-cb-muted">{kit.footerText}</p> : null}
            <p className="mt-2 text-xs text-cb-muted">Prepared by {preparedBy}</p>
          </div>
        )}
      </div>
    </main>
  );
}
