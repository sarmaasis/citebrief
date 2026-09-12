import { eq } from "drizzle-orm";
import { workspaces } from "@/db/schema";
import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const body = (await request.json()) as {
    name?: string;
    timezone?: string;
    senderName?: string;
    defaultEngines?: string;
  };
  const name = body.name?.trim();
  if (!name) return jsonError("Workspace name is required.");

  await ctx.db
    .update(workspaces)
    .set({
      name,
      timezone: body.timezone?.trim() || "America/New_York",
      senderName: body.senderName?.trim() || null,
      defaultEngines: body.defaultEngines?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, ctx.workspace.id));

  return jsonOk({ ok: true });
}
