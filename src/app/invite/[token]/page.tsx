import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { AuthLegalLinks } from "@/components/marketing/footer";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { InviteAcceptButton } from "@/components/settings/invite-accept-button";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { workspaceInvites, workspaceMembers, workspaces } from "@/db/schema";
import { getAppContext } from "@/lib/session";

function isExpired(expiresAt: Date) {
  return expiresAt.getTime() < Date.now();
}

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const [invite] = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, token)).limit(1);
  if (!invite) notFound();
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, invite.workspaceId)).limit(1);
  const ctx = await getAppContext();
  const expired = isExpired(invite.expiresAt);
  const accepted = Boolean(invite.acceptedAt);
  const alreadyMember = ctx
    ? Boolean(
        (
          await db
            .select({ id: workspaceMembers.id })
            .from(workspaceMembers)
            .where(
              and(eq(workspaceMembers.workspaceId, invite.workspaceId), eq(workspaceMembers.userId, ctx.user.id)),
            )
            .limit(1)
        )[0],
      )
    : false;
  const emailMismatch =
    Boolean(ctx) && ctx!.user.email.trim().toLowerCase() !== invite.email.trim().toLowerCase();
  const workspaceName = workspace?.name || "this workspace";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Join {workspaceName}</h1>
      <p className="mt-2 text-sm text-cb-muted">
        Invited as <span className="text-cb-text">{invite.role}</span> for {invite.email}.
      </p>

      {accepted || alreadyMember ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-cb-text">
            {alreadyMember ? `You are already in ${workspaceName}.` : "This invite was already accepted."}
          </p>
          <Button asChild>
            <Link href="/app">Go to home</Link>
          </Button>
        </div>
      ) : expired ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-cb-missing">This invite expired. Ask an owner to send a new one.</p>
          <Button asChild variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      ) : !ctx ? (
        <div className="mt-8 space-y-3">
          <Button asChild className="w-full">
            <Link href={`/signup?invite=${token}`}>Create an account to accept</Link>
          </Button>
          <p className="text-sm text-cb-muted">
            Already have an account?{" "}
            <Link className="text-cb-accent" href={`/login?invite=${token}`}>
              Sign in
            </Link>
          </p>
          <p className="text-xs text-cb-muted">Use {invite.email} so the invite matches.</p>
        </div>
      ) : emailMismatch ? (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-cb-text">
            You are signed in as {ctx.user.email}. This invite is for {invite.email}.
          </p>
          <SignOutButton next={`/login?invite=${token}`} variant="outline" size="default" label="Sign out and switch" />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          <p className="text-sm text-cb-muted">Join as a member. You will see this agency’s brands and Friday reports.</p>
          <InviteAcceptButton token={token} />
        </div>
      )}
      <AuthLegalLinks />
    </div>
  );
}
