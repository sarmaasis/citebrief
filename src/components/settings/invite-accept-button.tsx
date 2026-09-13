"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormNoticeText, type FormNotice } from "@/components/ui/form-notice";

export function InviteAcceptButton({ token }: { token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<FormNotice | null>(null);

  async function accept() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setNotice({ type: "error", text: data.error ?? "Could not accept invite." });
        return;
      }
      setNotice({ type: "success", text: "Joined workspace." });
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
      <FormNoticeText notice={notice} />
    </div>
  );
}
