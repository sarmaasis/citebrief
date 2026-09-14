import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { Logo } from "@/components/brand/logo";
import { AuthLegalLinks } from "@/components/marketing/footer";
import { LOCAL_OTP_HINT } from "@/lib/auth-otp";
import { safeNextPath } from "@/lib/marketing-cta";
import { getMarketingAuth } from "@/lib/session";
import { metadataPages } from "@/lib/seo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = metadataPages.verify;

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string; invite?: string }>;
}) {
  const params = await searchParams;
  const email = params.email?.trim() || "";
  const invite = params.invite?.trim() || null;
  const nextPath = invite ? `/invite/${invite}` : safeNextPath(params.next);
  const auth = await getMarketingAuth();
  if (auth.signedIn) {
    redirect(invite ? `/invite/${invite}` : nextPath === "/app" ? auth.appHref : nextPath);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12 sm:px-6 sm:py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Verify your email</h1>
      <p className="mt-2 text-sm leading-6 text-cb-muted">{LOCAL_OTP_HINT}</p>
      <div className="mt-8">
        <VerifyEmailForm email={email} nextPath={nextPath} inviteToken={invite} />
      </div>
      <p className="mt-6 text-sm text-cb-muted">
        Need a different email?{" "}
        <Link href="/signup" className="text-cb-accent">
          Start over
        </Link>
      </p>
      <AuthLegalLinks />
    </main>
  );
}
