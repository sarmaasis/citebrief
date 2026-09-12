import { eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { workspaceInvites, workspaceMembers } from "@/db/schema";
import { planAllowsMembers } from "@/lib/billing";
import { sendTransactionalEmail } from "@/lib/email";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const members = await ctx.db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, ctx.workspace.id));
  const invites = await ctx.db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, ctx.workspace.id));
  return jsonOk({ members, invites });
}

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  if (!planAllowsMembers(sub?.plan || "agency")) {
    return jsonError("Member invites require Agency or Studio.", 402);
  }

  const body = (await request.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return jsonError("A valid email is required.");
  }
  const role = body.role === "owner" ? "owner" : "member";
  const token = crypto.randomUUID().replaceAll("-", "");
  const now = new Date();

  await ctx.db.insert(workspaceInvites).values({
    id: crypto.randomUUID(),
    workspaceId: ctx.workspace.id,
    email,
    role,
    token,
    invitedBy: ctx.user.id,
    expiresAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
    createdAt: now,
  });

  const { env } = await getCloudflareContext({ async: true });
  const link = `${(env.BETTER_AUTH_URL || "").replace(/\/$/, "")}/invite/${token}`;
  await sendTransactionalEmail({
    to: email,
    subject: `Join ${ctx.workspace.name} on CiteBrief`,
    html: `<p>You were invited to <strong>${ctx.workspace.name}</strong> as ${role}.</p><p><a href="${link}">Accept invite</a></p>`,
    env,
  });

  return jsonOk({ ok: true, token, link }, 201);
}
