import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/brand/logo";
import { AuthLegalLinks } from "@/components/marketing/footer";
import { postAuthPath, readPlanAndInterval, signupHref } from "@/lib/marketing-cta";
import { getMarketingAuth } from "@/lib/session";
import { metadataPages } from "@/lib/seo";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata: Metadata = metadataPages.login;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; plan?: string; interval?: string }>;
}) {
  const params = await searchParams;
  const invite = params.invite?.trim() || null;
  const { planId, interval } = invite ? { planId: null, interval: "monthly" as const } : readPlanAndInterval(params);
  const auth = await getMarketingAuth();
  if (auth.signedIn) {
    if (invite) redirect(`/invite/${invite}`);
    redirect(postAuthPath({ plan: planId, interval }));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-cb-muted">
        {invite
          ? "Sign in with the invited email to join the workspace."
          : interval === "annual" && planId
            ? `Email and password, a magic link, or Google. Then continue to ${planId} annual checkout.`
            : "Email and password, a magic link, or Google."}
      </p>
      <div className="mt-8">
        <AuthForm
          mode="login"
          inviteToken={invite}
          nextPath={postAuthPath({ inviteToken: invite, plan: planId, interval })}
        />
      </div>
      <p className="mt-6 text-sm text-cb-muted">
        New to CiteBrief?{" "}
        <Link href={invite ? `/signup?invite=${invite}` : signupHref(planId ?? "agency", interval)} className="text-cb-accent">
          Start the first report
        </Link>
      </p>
      <AuthLegalLinks />
    </main>
  );
}
