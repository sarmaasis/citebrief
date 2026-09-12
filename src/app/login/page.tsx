import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { Logo } from "@/components/brand/logo";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <Logo />
      <h1 className="mt-10 text-2xl font-semibold tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-cb-muted">Email and password, a magic link, or Google.</p>
      <div className="mt-8">
        <AuthForm mode="login" />
      </div>
      <p className="mt-6 text-sm text-cb-muted">
        New to CiteBrief?{" "}
        <Link href="/signup" className="text-cb-accent">
          Start the first report
        </Link>
      </p>
    </div>
  );
}
