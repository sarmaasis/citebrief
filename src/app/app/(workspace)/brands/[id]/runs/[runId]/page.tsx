import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { RunStatus } from "@/components/runs/run-status";
import { parseEngineStatus } from "@/lib/engines";
import { getAppContext } from "@/lib/session";
import { brands, runs } from "@/db/schema";

export default async function RunPage({
  params,
}: {
  params: Promise<{ id: string; runId: string }>;
}) {
  const ctx = await getAppContext();
  if (!ctx) {
    notFound();
  }
  const { id, runId } = await params;
  const [row] = await ctx.db
    .select()
    .from(runs)
    .innerJoin(brands, eq(brands.id, runs.brandId))
    .where(and(eq(runs.id, runId), eq(brands.id, id), eq(brands.workspaceId, ctx.workspace.id)))
    .limit(1);

  if (!row) {
    notFound();
  }

  return (
    <RunStatus
      brandId={id}
      runId={runId}
      initialStatus={row.runs.status}
      initialEngines={parseEngineStatus(row.runs.engineStates)}
    />
  );
}
