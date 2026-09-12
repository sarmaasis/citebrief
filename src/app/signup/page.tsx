import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Sign up",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const params = await searchParams;
  const invite = params.invite?.trim() || null;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">
        {invite ? "Accept your invite" : "Start the first report"}
      </h1>
      <p className="mt-2 text-sm text-cb-muted">
        {invite
          ? "Create an account with the invited email. You will join the agency workspace."
          : "Create a workspace. Invite account managers from Settings on Agency or Studio."}
      </p>
      <div className="mt-8">
        <AuthForm mode="signup" inviteToken={invite} />
      </div>
      <p className="mt-6 text-sm text-cb-muted">
        Already have an account?{" "}
        <Link href={invite ? `/login?invite=${invite}` : "/login"} className="text-cb-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
