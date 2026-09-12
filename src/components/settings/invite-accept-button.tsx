"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InviteAcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not accept invite.");
        return;
      }
      setMessage("Joined workspace.");
      router.push("/app");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Button type="button" disabled={busy} onClick={() => void accept()}>
        {busy ? "Joining…" : "Accept invite"}
      </Button>
      {message ? <p className="text-sm text-cb-muted">{message}</p> : null}
    </div>
  );
}
