import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db";
import { workspaceInvites, workspaceMembers, workspaces } from "@/db/schema";

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

  if (!existing) {
    await db.insert(workspaceMembers).values({
      id: crypto.randomUUID(),
      workspaceId: invite.workspaceId,
      userId: user.id,
      role: "member", // invites never grant owner
      createdAt: new Date(),
    });
  }

  await db
    .update(workspaceInvites)
    .set({ acceptedAt: new Date() })
    .where(eq(workspaceInvites.id, invite.id));

  return { ok: true, workspaceId: invite.workspaceId, role: "member" };
}

/**
 * Ensure the user has a workspace. Pending email invites join that workspace
 * instead of minting a new owner workspace.
 */
export async function ensureWorkspaceForUser(
  db: Database,
  user: { id: string; name?: string | null; email: string },
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
}
