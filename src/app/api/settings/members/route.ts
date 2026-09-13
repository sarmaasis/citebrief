import { and, eq, isNull } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { users, workspaceInvites, workspaceMembers } from "@/db/schema";
import { sendTransactionalEmail } from "@/lib/email";
import { upgradeHintForSeatCap, workspaceEntitlements } from "@/lib/entitlements";
import { writeAuditLog } from "@/lib/audit";
import { canInviteMembers, requireOwner } from "@/lib/permissions";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getAppContext } from "@/lib/session";
import { countOccupiedSeats, getWorkspaceSubscription } from "@/lib/usage";
import { revokePendingInvite } from "@/lib/workspace";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const members = await ctx.db
    .select({
      id: workspaceMembers.id,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      createdAt: workspaceMembers.createdAt,
      email: users.email,
      name: users.name,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, ctx.workspace.id));
  const invites = await ctx.db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.workspaceId, ctx.workspace.id));
  const now = Date.now();
  const activePending = invites.filter(
    (invite) => invite.acceptedAt == null && invite.expiresAt.getTime() >= now,
  );
  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const seatsUsed = members.length + activePending.length;
  return jsonOk({
    members,
    invites,
    seatCap: ent.seatCap,
    seatsUsed,
    extraSeats: ent.extraSeats,
    allowsMembers: ent.allowsMembers,
    role: ctx.role,
    canInvite: Boolean(ctx.impersonating) || canInviteMembers(ctx.role),
    canRevoke: Boolean(ctx.impersonating) || canInviteMembers(ctx.role),
  });
}

export async function POST(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireOwner(ctx, "Only workspace owners can invite members.");
  if (denied) return denied;

  const { env } = await getCloudflareContext({ async: true });
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.invite, ctx.workspace.id);
  if (limited) return limited;

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  if (!ent.allowsMembers) {
    return jsonError("Member invites require Agency, Studio, or Enterprise.", 402);
  }

  const seats = await countOccupiedSeats(ctx.db, ctx.workspace.id);
  if (seats.occupied >= ent.seatCap) {
    return jsonError(upgradeHintForSeatCap(ent), 403);
  }

  const body = (await request.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return jsonError("A valid email is required.");
  }

  const [alreadyMember] = await ctx.db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(users.email, email)))
    .limit(1);
  if (alreadyMember) {
    return jsonError("That person is already a member of this workspace.");
  }

  const now = Date.now();
  const [existingInvite] = (
    await ctx.db
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, ctx.workspace.id),
          eq(workspaceInvites.email, email),
          isNull(workspaceInvites.acceptedAt),
        ),
      )
  ).filter((invite) => invite.expiresAt.getTime() >= now);
  if (existingInvite) {
    return jsonError("An invite is already pending for that email.");
  }

  const role = body.role === "admin" ? "admin" : "member";
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

  const link = `${(env.BETTER_AUTH_URL || "").replace(/\/$/, "")}/invite/${token}`;
  await sendTransactionalEmail({
    to: email,
    subject: `Join ${ctx.workspace.name} on CiteBrief`,
    html: `<p>You were invited to <strong>${ctx.workspace.name}</strong> as ${role}.</p><p><a href="${link}">Accept invite</a></p>`,
    env,
  });

  await writeAuditLog(ctx.db, {
    action: "invite.create",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "invite",
    targetId: email,
    request,
    metadata: { role },
  });

  return jsonOk({ ok: true, token, link, seatCap: ent.seatCap, seatsUsed: seats.occupied + 1, role }, 201);
}

export async function DELETE(request: Request) {
  const ctx = await getAppContext();
  if (!ctx) return jsonError("Sign in required.", 401);
  const denied = requireOwner(ctx, "Only workspace owners can revoke invites or remove members.");
  if (denied) return denied;

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim();
  const inviteId = url.searchParams.get("inviteId")?.trim();
  if (userId && inviteId) return jsonError("Provide userId or inviteId, not both.");

  if (inviteId) {
    const revoked = await revokePendingInvite(ctx.db, ctx.workspace.id, inviteId);
    if (!revoked.ok) return jsonError(revoked.error, revoked.status);
    await writeAuditLog(ctx.db, {
      action: "invite.revoke",
      workspaceId: ctx.workspace.id,
      actorUserId: ctx.user.id,
      actorEmail: ctx.user.email,
      targetType: "invite",
      targetId: inviteId,
      request,
    });
    const seats = await countOccupiedSeats(ctx.db, ctx.workspace.id);
    const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
    const ent = workspaceEntitlements(sub);
    return jsonOk({
      ok: true,
      revoked: true,
      inviteId,
      seatsUsed: seats.occupied,
      seatCap: ent.seatCap,
    });
  }

  if (!userId) return jsonError("userId or inviteId is required.");
  if (userId === ctx.user.id) return jsonError("You cannot remove yourself.");

  const [target] = await ctx.db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, ctx.workspace.id), eq(workspaceMembers.userId, userId)))
    .limit(1);
  if (!target) return jsonError("Member not found.", 404);
  if (target.role === "owner") return jsonError("Cannot remove the workspace owner.");

  await ctx.db.delete(workspaceMembers).where(eq(workspaceMembers.id, target.id));
  await writeAuditLog(ctx.db, {
    action: "member.remove",
    workspaceId: ctx.workspace.id,
    actorUserId: ctx.user.id,
    actorEmail: ctx.user.email,
    targetType: "member",
    targetId: userId,
    request,
  });
  const seats = await countOccupiedSeats(ctx.db, ctx.workspace.id);
  return jsonOk({ ok: true, removed: true, userId, seatsUsed: seats.occupied });
}
