"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/auth/client";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCAL_OTP_HINT } from "@/lib/auth-otp";

/** Product kill: hide Google OAuth until we turn it back on. Provider stays in auth/index.ts. */
export const SHOW_GOOGLE_AUTH = false;

function needsEmailVerify(error: { code?: string; message?: string | null } | null | undefined) {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  return code === "EMAIL_NOT_VERIFIED" || /not verified/i.test(message);
}

function verifyHref(email: string, nextPath: string, inviteToken?: string | null) {
  const params = new URLSearchParams({ email });
  if (inviteToken) params.set("invite", inviteToken);
  if (nextPath && nextPath !== "/app") params.set("next", nextPath);
  return `/verify?${params.toString()}`;
}

export function AuthForm({
  mode,
  inviteToken = null,
  nextPath,
  initialEmail = "",
}: {
  mode: "login" | "signup";
  inviteToken?: string | null;
  nextPath?: string | null;
  initialEmail?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [verifyStep, setVerifyStep] = useState(false);
  const router = useRouter();
  const resolvedNext = inviteToken
    ? `/invite/${inviteToken}`
    : nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")
      ? nextPath
      : "/app";

  async function onPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      if (mode === "signup") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: name || email.split("@")[0],
          callbackURL: resolvedNext,
        });
        if (result.error) {
          setStatus(result.error.message ?? "Could not create the account.");
          return;
        }
        router.replace(verifyHref(email, resolvedNext, inviteToken));
        return;
      }

      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: resolvedNext,
      });
      if (result.error) {
        if (needsEmailVerify(result.error)) {
          await authClient.emailOtp.sendVerificationOtp({
            email,
            type: "email-verification",
          });
          setVerifyStep(true);
          setStatus(null);
          return;
        }
        setStatus(result.error.message ?? "Could not sign in.");
        return;
      }
      router.push(resolvedNext);
      router.refresh();
    } catch {
      setStatus("Auth is not ready. Check D1 bindings and BETTER_AUTH secrets.");
    } finally {
      setPending(false);
    }
  }

  async function onMagicLink() {
    setPending(true);
    setStatus(null);
    try {
      const result = await authClient.signIn.magicLink({
        email,
        name: name || email.split("@")[0],
        callbackURL: resolvedNext === "/app" && mode === "signup" ? "/app/onboarding" : resolvedNext,
      });
      if (result.error) {
        setStatus(result.error.message ?? "Could not send the magic link.");
        return;
      }
      setStatus("We emailed a sign-in link. In local dev it is printed in the terminal running next dev.");
    } catch {
      setStatus("Could not send the magic link. Check /api/auth and the next-dev terminal.");
    } finally {
      setPending(false);
    }
  }

  async function onGoogle() {
    setPending(true);
    setStatus(null);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: resolvedNext,
      });
    } catch {
      setStatus("Google OAuth needs live GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
      setPending(false);
    }
  }

  if (verifyStep) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-cb-muted">
          Password accepted for {email}. {LOCAL_OTP_HINT}
        </p>
        <VerifyEmailForm email={email} nextPath={resolvedNext} inviteToken={inviteToken} hideEmail />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onPassword} className="space-y-4">
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Northline Agency"
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@agency.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={pending}>
          {mode === "signup" ? (inviteToken ? "Accept invite" : "Start the first report") : "Sign in"}
        </Button>
      </form>

      <div className="grid gap-2">
        <Button type="button" variant="outline" className="w-full" onClick={() => void onMagicLink()} disabled={pending || !email}>
          Email a magic link
        </Button>
        {SHOW_GOOGLE_AUTH ? (
          <Button type="button" variant="outline" onClick={() => void onGoogle()} disabled={pending}>
            Continue with Google
          </Button>
        ) : null}
      </div>

      {status ? <p className="text-sm text-cb-muted">{status}</p> : null}
    </div>
  );
}
