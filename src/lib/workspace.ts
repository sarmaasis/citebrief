import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { subscriptions, workspaceInvites, workspaceMembers, workspaces } from "@/db/schema";
import { isVerifiedAuthUser } from "@/lib/auth-access";
import { planSeatCap, trialSubscriptionPatch } from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
import { getWorkspaceSubscription } from "@/lib/usage";

export async function acceptInviteForUser(
  db: Database,
  user: { id: string; email: string },
  token: string,
): Promise<{ ok: true; workspaceId: string; role: string } | { ok: false; error: string }> {
  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(eq(workspaceInvites.token, token))
    .limit(1);
  if (!invite) return { ok: false, error: "Invite not found." };
  if (invite.acceptedAt) return { ok: false, error: "Invite already accepted." };
  if (invite.expiresAt.getTime() < Date.now()) return { ok: false, error: "Invite expired." };
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    return { ok: false, error: "Sign in with the invited email to accept." };
  }

  const [existing] = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, invite.workspaceId), eq(workspaceMembers.userId, user.id)))
    .limit(1);

  const role = invite.role === "admin" ? "admin" : "member";

  if (!existing) {
    const sub = await getWorkspaceSubscription(db, invite.workspaceId);
    const ent = workspaceEntitlements(sub);
    const members = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, invite.workspaceId));
    const cap = planSeatCap(ent.plan, ent.extraSeats);
    if (members.length >= cap) {
      return {
        ok: false,
        error: `Seat cap reached (${members.length}/${cap}). Ask the owner to add a seat or upgrade.`,
      };
    }
    await db.insert(workspaceMembers).values({
      id: crypto.randomUUID(),
      workspaceId: invite.workspaceId,
      userId: user.id,
      role,
      createdAt: new Date(),
    });
  }

  await db
    .update(workspaceInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(workspaceInvites.id, invite.id));

  return { ok: true, workspaceId: invite.workspaceId, role };
}

/**
 * Owner revoke of a pending invite. Frees the reserved seat immediately.
 * Accepted invites are treated as not found so the pending list stays the source of truth.
 */
export async function revokePendingInvite(
  db: Database,
  workspaceId: string,
  inviteId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: 404 }> {
  const [invite] = await db
    .select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.id, inviteId), eq(workspaceInvites.workspaceId, workspaceId)))
    .limit(1);
  if (!invite || invite.acceptedAt) {
    return { ok: false, error: "Invite not found.", status: 404 };
  }
  await db.delete(workspaceInvites).where(eq(workspaceInvites.id, invite.id));
  return { ok: true };
}

/**
 * Ensure the user has a workspace. Pending email invites join that workspace
 * instead of minting a new owner workspace.
 * PRODUCT §5: workspace is created on first verified login.
 */
export async function ensureWorkspaceForUser(
  db: Database,
  user: { id: string; name?: string | null; email: string; emailVerified?: boolean | null },
  inviteToken?: string | null,
) {
  const existing = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);

  if (existing[0]) {
    if (inviteToken) {
      await acceptInviteForUser(db, user, inviteToken);
    }
    return;
  }

  if (!isVerifiedAuthUser(user)) {
    return;
  }

  if (inviteToken) {
    const accepted = await acceptInviteForUser(db, user, inviteToken);
    if (accepted.ok) return;
  }

  // Auto-claim matching pending invite by email (signup without token in URL).
  const [pending] = await db
    .select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.email, user.email.toLowerCase()), isNull(workspaceInvites.acceptedAt)))
    .limit(1);
  if (pending && pending.expiresAt.getTime() >= Date.now()) {
    const accepted = await acceptInviteForUser(db, user, pending.token);
    if (accepted.ok) return;
  }

  const workspaceId = crypto.randomUUID();
  const now = new Date();
  const label = user.name?.trim() || user.email.split("@")[0] || "Workspace";

  await db.insert(workspaces).values({
    id: workspaceId,
    name: `${label} workspace`,
    timezone: "America/New_York",
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(workspaceMembers).values({
    id: crypto.randomUUID(),
    workspaceId,
    userId: user.id,
    role: "owner",
    createdAt: now,
  });

  const trial = trialSubscriptionPatch(now);
  await db.insert(subscriptions).values({
    id: crypto.randomUUID(),
    workspaceId,
    ...trial,
    createdAt: now,
    updatedAt: now,
  });
}
