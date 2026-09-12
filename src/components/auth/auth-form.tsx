"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AuthForm({
  mode,
  inviteToken = null,
}: {
  mode: "login" | "signup";
  inviteToken?: string | null;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const nextPath = inviteToken ? `/invite/${inviteToken}` : "/app";

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
          callbackURL: nextPath,
        });
        if (result.error) {
          setStatus(result.error.message ?? "Could not create the account.");
          return;
        }
        if (inviteToken) {
          await fetch("/api/invites/accept", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: inviteToken }),
          });
        }
        setStatus("Account created. Opening the app.");
        router.push(nextPath);
        router.refresh();
        return;
      }

      const result = await authClient.signIn.email({
        email,
        password,
        callbackURL: nextPath,
      });
      if (result.error) {
        setStatus(result.error.message ?? "Could not sign in.");
        return;
      }
      router.push(nextPath);
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
        callbackURL: nextPath,
      });
      if (result.error) {
        setStatus(result.error.message ?? "Could not send the magic link.");
        return;
      }
      setStatus("If Resend is configured, check email. Otherwise the Worker log has the stub.");
    } catch {
      setStatus("Magic link stub needs /api/auth and Resend or a local log.");
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
        callbackURL: nextPath,
      });
    } catch {
      setStatus("Google OAuth needs live GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
      setPending(false);
    }
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
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="grid gap-2">
        <Button type="button" variant="outline" onClick={onMagicLink} disabled={pending || !email}>
          Email a magic link
        </Button>
        <Button type="button" variant="outline" onClick={onGoogle} disabled={pending}>
          Continue with Google
        </Button>
      </div>

      {status ? <p className="text-sm text-cb-muted">{status}</p> : null}
    </div>
  );
}
