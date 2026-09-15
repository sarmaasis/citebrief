import { and, eq } from "drizzle-orm";
import { brands, prompts, runRows, runs } from "@/db/schema";
import { getAppContext } from "@/lib/session";
import { jsonError } from "@/server/json";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; runId: string }> };

function csvValue(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);

  const { id, runId } = await context.params;
  const [run] = await ctx.db
    .select({ id: runs.id })
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .where(and(eq(runs.id, runId), eq(runs.brandId, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);
  if (!run) return jsonError("Run not found.", 404);

  const rows = await ctx.db
    .select({
      prompt: prompts.text,
      mix: prompts.mix,
      intent: prompts.intent,
      branded: prompts.branded,
      engine: runRows.engine,
      mentioned: runRows.mentioned,
      recommended: runRows.recommended,
      position: runRows.position,
      sentiment: runRows.sentiment,
      whoWon: runRows.whoWon,
      othersNamed: runRows.othersNamed,
      citedUrls: runRows.citedUrls,
      citedBrandUrl: runRows.citedBrandUrl,
      sentence: runRows.sentence,
      verbatim: runRows.verbatim,
      nextAction: runRows.nextAction,
      confidence: runRows.confidence,
      status: runRows.status,
    })
    .from(runRows)
    .innerJoin(prompts, eq(prompts.id, runRows.promptId))
    .where(eq(runRows.runId, runId))
    .orderBy(prompts.sortOrder);

  function parseNamed(raw: string | null) {
    if (!raw) return [] as string[];
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  const exportRows = rows.map((row) => {
    const { othersNamed, ...rest } = row;
    return { ...rest, competitorsNamed: parseNamed(othersNamed) };
  });

  const url = new URL(request.url);
  if (url.searchParams.get("format") === "csv") {
    const headers = Object.keys(exportRows[0] ?? {
      prompt: "",
      mix: "",
      intent: "",
      branded: "",
      engine: "",
      mentioned: "",
      recommended: "",
      position: "",
      sentiment: "",
      whoWon: "",
      competitorsNamed: "",
      citedUrls: "",
      citedBrandUrl: "",
      sentence: "",
      verbatim: "",
      nextAction: "",
      confidence: "",
      status: "",
    });
    const body = [
      headers.join(","),
      ...exportRows.map((row) =>
        headers
          .map((key) => {
            const value = row[key as keyof typeof row];
            return csvValue(Array.isArray(value) ? value.join("; ") : value);
          })
          .join(","),
      ),
    ].join("\n");
    return new Response(body, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="citebrief-${runId}.csv"`,
      },
    });
  }

  return Response.json({ runId, rows: exportRows });
}
