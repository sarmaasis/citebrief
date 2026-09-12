import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { InviteAcceptButton } from "@/components/settings/invite-accept-button";
import { getDb } from "@/db";
import { workspaceInvites, workspaces } from "@/db/schema";
import { getAppContext } from "@/lib/session";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const [invite] = await db.select().from(workspaceInvites).where(eq(workspaceInvites.token, token)).limit(1);
  if (!invite) notFound();
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, invite.workspaceId)).limit(1);
  const ctx = await getAppContext();
  const expired = invite.expiresAt.getTime() < Date.now();
  const accepted = Boolean(invite.acceptedAt);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Join {workspace?.name || "workspace"}</h1>
      <p className="mt-2 text-sm text-cb-muted">
        Invited as <span className="text-cb-text">{invite.role}</span> for {invite.email}.
      </p>
      {accepted ? (
        <p className="mt-6 text-sm text-cb-muted">This invite was already accepted.</p>
      ) : expired ? (
        <p className="mt-6 text-sm text-cb-missing">This invite expired. Ask an owner to send a new one.</p>
      ) : ctx ? (
        <div className="mt-8">
          <InviteAcceptButton token={token} />
        </div>
      ) : (
        <div className="mt-8 space-y-3 text-sm">
          <Link className="text-cb-accent" href={`/signup?invite=${token}`}>
            Create an account to accept
          </Link>
          <p className="text-cb-muted">
            Already have an account?{" "}
            <Link className="text-cb-accent" href={`/login?invite=${token}`}>
              Sign in
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
