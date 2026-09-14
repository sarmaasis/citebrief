import { and, eq, inArray, isNull } from "drizzle-orm";
import { getAppContext } from "@/lib/session";
import { normalizePromptDrafts, type PromptDraft, validatePromptSet } from "@/lib/prompts";
import { planPromptSave } from "@/lib/prompt-persist";
import { workspaceEntitlements } from "@/lib/entitlements";
import { jsonError, jsonOk } from "@/server/json";
import { getWorkspaceBrand } from "@/server/workspace-data";
import { getWorkspaceSubscription } from "@/lib/usage";
import { prompts } from "@/db/schema";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) {
    return jsonError("Brand not found.", 404);
  }
  const rows = await ctx.db
    .select()
    .from(prompts)
    .where(and(eq(prompts.brandId, id), isNull(prompts.archivedAt)))
    .orderBy(prompts.sortOrder);
  return jsonOk({ prompts: rows });
}

export async function PUT(request: Request, context: RouteContext) {
  const ctx = await getAppContext();
  if (!ctx) {
    return jsonError("Sign in required.", 401);
  }
  const { id } = await context.params;
  const brand = await getWorkspaceBrand(ctx, id);
  if (!brand) {
    return jsonError("Brand not found.", 404);
  }

  const body = (await request.json()) as { prompts?: PromptDraft[] };
  const drafts = normalizePromptDrafts(body.prompts ?? []);
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const check = validatePromptSet(drafts, brand.name, { maxCount: ent.promptCap });
  if (!check.ok) {
    return jsonError(check.error);
  }

  const now = new Date();
  try {
    const existing = await ctx.db.select().from(prompts).where(eq(prompts.brandId, id));
    const plan = planPromptSave(
      existing.map((row) => ({
        id: row.id,
        text: row.text,
        mix: row.mix,
        sortOrder: row.sortOrder,
        archivedAt: row.archivedAt ?? null,
      })),
      drafts,
    );

    for (const update of plan.updates) {
      await ctx.db
        .update(prompts)
        .set({
          text: update.text,
          mix: update.mix,
          sortOrder: update.sortOrder,
          updatedAt: now,
          ...(update.unarchive ? { archivedAt: null } : {}),
        })
        .where(eq(prompts.id, update.id));
    }

    for (const draft of plan.inserts) {
      await ctx.db.insert(prompts).values({
        id: crypto.randomUUID(),
        brandId: id,
        text: draft.text,
        mix: draft.mix,
        sortOrder: draft.sortOrder,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (plan.archiveIds.length > 0) {
      await ctx.db
        .update(prompts)
        .set({ archivedAt: now, updatedAt: now })
        .where(and(eq(prompts.brandId, id), inArray(prompts.id, plan.archiveIds)));
    }
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not save prompts.", 500);
  }

  return jsonOk({
    saved: drafts.length,
    archived: true,
  });
}
