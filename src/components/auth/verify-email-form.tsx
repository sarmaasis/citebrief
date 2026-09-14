"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCAL_OTP_HINT } from "@/lib/auth-otp";
import { safeNextPath } from "@/lib/marketing-cta";

export function VerifyEmailForm({
  email: initialEmail,
  nextPath,
  inviteToken = null,
  hideEmail = false,
}: {
  email?: string | null;
  nextPath?: string | null;
  inviteToken?: string | null;
  hideEmail?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail ?? "");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<string | null>(LOCAL_OTP_HINT);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const resolvedNext = inviteToken ? `/invite/${inviteToken}` : safeNextPath(nextPath);

  async function onVerify(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      const result = await authClient.emailOtp.verifyEmail({
        email,
        otp: otp.replace(/\D/g, ""),
      });
      if (result.error) {
        setStatus(result.error.message ?? "That code is not valid. Try again or resend.");
        return;
      }
      if (inviteToken) {
        await fetch("/api/invites/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: inviteToken }),
        });
      }
      router.push(resolvedNext === "/app" ? "/app/onboarding" : resolvedNext);
      router.refresh();
    } catch {
      setStatus("Could not verify the code. Check /api/auth and try again.");
    } finally {
      setPending(false);
    }
  }

  async function onResend() {
    setPending(true);
    setStatus(null);
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (result.error) {
        setStatus(result.error.message ?? "Could not resend the code.");
        return;
      }
      setStatus(LOCAL_OTP_HINT);
    } catch {
      setStatus("Could not resend the code.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onVerify} className="space-y-4">
      {hideEmail ? null : (
        <div className="space-y-2">
          <Label htmlFor="verify-email">Email</Label>
          <Input
            id="verify-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@agency.com"
            autoComplete="email"
            readOnly={Boolean(initialEmail)}
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="otp">Verification code</Label>
        <Input
          id="otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          minLength={6}
          maxLength={8}
          value={otp}
          onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))}
          placeholder="000000"
          className="tracking-[0.28em]"
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending || !email || otp.length < 6}>
        Verify email
      </Button>
      <Button type="button" variant="outline" className="w-full" disabled={pending || !email} onClick={() => void onResend()}>
        Resend code
      </Button>
      {status ? <p className="text-sm text-cb-muted">{status}</p> : null}
    </form>
  );
}
