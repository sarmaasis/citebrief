import { and, eq, isNull } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { workspaceInvites, workspaceMembers } from "@/db/schema";
import { planAllowsMembers, planSeatCap } from "@/lib/billing";
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
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const seatCap = planSeatCap(sub?.plan || "agency");
  return jsonOk({ members, invites, seatCap, seatsUsed: members.length });
}

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);

  const [ownerMembership] = await ctx.db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, ctx.workspace.id),
        eq(workspaceMembers.userId, ctx.user.id),
        eq(workspaceMembers.role, "owner"),
      ),
    )
    .limit(1);
  if (!ownerMembership) {
    return jsonError("Only workspace owners can invite members.", 403);
  }

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const plan = sub?.plan || "agency";
  if (!planAllowsMembers(plan)) {
    return jsonError("Member invites require Agency or Studio.", 402);
  }

  const seatCap = planSeatCap(plan);
  const members = await ctx.db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, ctx.workspace.id));
  const now = Date.now();
  const activePending = (
    await ctx.db
      .select()
      .from(workspaceInvites)
      .where(
        and(eq(workspaceInvites.workspaceId, ctx.workspace.id), isNull(workspaceInvites.acceptedAt)),
      )
  ).filter((invite) => invite.expiresAt.getTime() >= now);

  const occupied = members.length + activePending.length;
  if (occupied >= seatCap) {
    return jsonError(
      `Seat cap reached (${occupied}/${seatCap}). Remove a member or upgrade your plan.`,
      403,
    );
  }

  const body = (await request.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return jsonError("A valid email is required.");
  }
  // Invites are member-only (ignore client role; never invite as owner).
  const role = "member";
  const token = crypto.randomUUID().replaceAll("-", "");
  const createdAt = new Date();

  await ctx.db.insert(workspaceInvites).values({
    id: crypto.randomUUID(),
    workspaceId: ctx.workspace.id,
    email,
    role,
    token,
    invitedBy: ctx.user.id,
    expiresAt: new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000),
    createdAt,
  });

  const { env } = await getCloudflareContext({ async: true });
  const link = `${(env.BETTER_AUTH_URL || "").replace(/\/$/, "")}/invite/${token}`;
  await sendTransactionalEmail({
    to: email,
    subject: `Join ${ctx.workspace.name} on CiteBrief`,
    html: `<p>You were invited to <strong>${ctx.workspace.name}</strong> as ${role}.</p><p><a href="${link}">Accept invite</a></p>`,
    env,
  });

  return jsonOk({ ok: true, token, link, seatCap, seatsUsed: occupied + 1 }, 201);
}
