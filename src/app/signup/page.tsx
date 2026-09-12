import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Sign up",
};

export default function SignupPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Start the first report</h1>
      <p className="mt-2 text-sm text-cb-muted">
        One owner per workspace in v1. Invite flow lands later.
      </p>
      <div className="mt-8">
        <AuthForm mode="signup" />
      </div>
      <p className="mt-6 text-sm text-cb-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-cb-accent">
          Sign in
        </Link>
      </p>
    </div>
  );
}
