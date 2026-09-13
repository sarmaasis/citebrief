"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/auth/client";
import { Button } from "@/components/ui/button";

export function SignOutButton({
  next = "/login",
  variant = "ghost",
  size = "sm",
  label = "Sign out",
}: {
  next?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg";
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function signOut() {
    setPending(true);
    try {
      await authClient.signOut();
      router.replace(next);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant={variant} size={size} disabled={pending} onClick={() => void signOut()}>
      {pending ? "Signing out…" : label}
    </Button>
  );
}
