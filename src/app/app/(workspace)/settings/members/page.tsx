import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { MembersForm } from "@/components/settings/members-form";
import { users, workspaceInvites, workspaceMembers } from "@/db/schema";
import { PLANS } from "@/lib/billing";
import { workspaceEntitlements } from "@/lib/entitlements";
import { canInviteMembers } from "@/lib/permissions";
import { getAppContext } from "@/lib/session";
import { getWorkspaceSubscription } from "@/lib/usage";

function isActiveInvite(invite: { expiresAt: Date; acceptedAt: Date | null }) {
  return invite.acceptedAt == null && invite.expiresAt.getTime() >= Date.now();
}

export default async function MembersPage() {
  const ctx = await getAppContext();
  if (!ctx) notFound();

  const sub = await getWorkspaceSubscription(ctx.db, ctx.workspace.id);
  const ent = workspaceEntitlements(sub);
  const members = await ctx.db
    .select({
      id: workspaceMembers.id,
      role: workspaceMembers.role,
      userId: workspaceMembers.userId,
      name: users.name,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, ctx.workspace.id));
  const invites = await ctx.db
    .select()
    .from(workspaceInvites)
    .where(and(eq(workspaceInvites.workspaceId, ctx.workspace.id), isNull(workspaceInvites.acceptedAt)));
  const activePending = invites.filter(isActiveInvite);
  const isOwner = canInviteMembers(ctx.role) || Boolean(ctx.impersonating);

  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">Members</h1>
      <p className="mt-3 text-sm text-cb-muted">
        Invite account managers on Agency (3 seats) or Studio (10 seats). Owners invite, remove, and revoke pending invites.
      </p>
      <div className="mt-8">
        <MembersForm
          members={members.map((row) => ({
            id: row.id,
            userId: row.userId,
            name: row.name,
            email: row.email,
            role: row.role,
            isYou: row.userId === ctx.user.id,
          }))}
          invites={activePending.map((invite) => ({
            id: invite.id,
            email: invite.email,
            role: invite.role,
            expiresAt: invite.expiresAt.toISOString(),
            accepted: Boolean(invite.acceptedAt),
          }))}
          seatCap={ent.seatCap}
          seatsUsed={members.length + activePending.length}
          extraSeats={ent.extraSeats}
          isOwner={isOwner}
          canRevoke={isOwner}
          allowsMembers={ent.allowsMembers}
          allowsExtraSeats={ent.allowsExtraSeats}
          planName={PLANS[ent.plan].name}
        />
      </div>
    </div>
  );
}
