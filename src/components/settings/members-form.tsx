"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UpgradePrompt, UPGRADE_COPY } from "@/components/billing/upgrade-prompt";
import { NativeSelect } from "@/components/ui/native-select";
import { SEAT_OVERAGE_USD } from "@/lib/billing";

export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  isYou: boolean;
};

export type InviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  accepted: boolean;
};

export function MembersForm({
  members,
  invites,
  seatCap,
  seatsUsed,
  extraSeats,
  isOwner,
  canRevoke,
  allowsMembers,
  allowsExtraSeats,
  planName,
}: {
  members: MemberRow[];
  invites: InviteRow[];
  seatCap: number;
  seatsUsed: number;
  extraSeats: number;
  isOwner: boolean;
  canRevoke?: boolean;
  allowsMembers: boolean;
  allowsExtraSeats: boolean;
  planName: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [message, setMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showSeatUpgrade, setShowSeatUpgrade] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const mayRevoke = canRevoke ?? isOwner;
  const pending = invites.filter((invite) => !invite.accepted);
  const atCap = seatsUsed >= seatCap;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isOwner || !allowsMembers || atCap) {
      setShowSeatUpgrade(true);
      return;
    }
    setBusy("invite");
    setMessage(null);
    setInviteLink(null);
    try {
      const response = await fetch("/api/settings/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = (await response.json()) as {
        error?: string;
        link?: string;
      };
      if (!response.ok) {
        setMessage(data.error ?? "Invite failed.");
        if (response.status === 402 || response.status === 403) setShowSeatUpgrade(true);
        return;
      }
      setMessage(`Invite sent to ${email}.`);
      setInviteLink(data.link ?? null);
      setEmail("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removeMember(userId: string) {
    if (!isOwner) return;
    setBusy(userId);
    setMessage(null);
    try {
      const response = await fetch(`/api/settings/members?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not remove that member.");
        return;
      }
      setMessage("Member removed.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function flash(next: string) {
    setToast(next);
    window.setTimeout(() => setToast(null), 4000);
  }

  async function revokeInvite(inviteId: string) {
    if (!mayRevoke) return;
    setBusy(`invite:${inviteId}`);
    setMessage(null);
    try {
      const response = await fetch(`/api/settings/members?inviteId=${encodeURIComponent(inviteId)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        flash(data.error ?? "Could not revoke that invite.");
        return;
      }
      setMessage("Invite revoked.");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function buyExtraSeat() {
    if (!isOwner || !allowsExtraSeats) {
      setShowSeatUpgrade(true);
      return;
    }
    setBusy("seat");
    setMessage(null);
    try {
      const response = await fetch("/api/billing/addon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addon: "extra_seat" }),
      });
      const data = (await response.json()) as { url?: string; error?: string; mode?: string };
      if (!response.ok) {
        setMessage(data.error ?? "Could not add a seat.");
        if (response.status === 402) setShowSeatUpgrade(true);
        return;
      }
      if (data.mode === "stub") {
        setMessage("Extra seat added. Send the invite.");
        router.refresh();
        return;
      }
      if (data.url) window.location.href = data.url;
    } finally {
      setBusy(null);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 3000);
  }

  const upgrade = !allowsMembers ? UPGRADE_COPY.membersStarter : atCap ? UPGRADE_COPY.extraSeat : null;

  return (
    <div className="space-y-8">
      <p className="text-sm text-cb-muted">
        Seats: {seatsUsed}/{seatCap} on {planName}
        {extraSeats ? ` · ${extraSeats} extra` : ""} (members + pending invites)
      </p>

      {upgrade && (showSeatUpgrade || !allowsMembers || atCap) ? (
        <div className="space-y-3">
          <UpgradePrompt title={upgrade.title} body={upgrade.body} cta={upgrade.cta} />
          {isOwner && atCap && allowsExtraSeats ? (
            <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void buyExtraSeat()}>
              {busy === "seat" ? "Starting…" : `Add extra seat · $${SEAT_OVERAGE_USD}/mo`}
            </Button>
          ) : null}
        </div>
      ) : null}

      <section>
        <h2 className="text-sm font-medium">People in this workspace</h2>
        <div className="mt-3 overflow-hidden rounded-cb-card border border-cb-line bg-cb-surface">
          <table className="w-full text-sm">
            <thead className="bg-cb-surface text-left text-cb-muted">
              <tr className="h-12 border-b border-cb-line">
                <th className="px-4 font-medium">Name</th>
                <th className="px-4 font-medium">Role</th>
                <th className="px-4 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} className="h-12 border-b border-cb-line last:border-0">
                  <td className="px-4">
                    <p className="font-medium">
                      {member.name || member.email}
                      {member.isYou ? <span className="ml-2 text-xs text-cb-muted">You</span> : null}
                    </p>
                    <p className="text-xs text-cb-muted">{member.email}</p>
                  </td>
                  <td className="px-4 capitalize text-cb-muted">{member.role}</td>
                  <td className="px-4 text-right">
                    {isOwner && !member.isYou && member.role !== "owner" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy !== null}
                        onClick={() => void removeMember(member.userId)}
                      >
                        {busy === member.userId ? "Removing…" : "Remove"}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium">Pending invites</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-cb-muted">No pending invites.</p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-cb-card border border-cb-line bg-cb-surface">
            {pending.map((invite) => (
              <li
                key={invite.id}
                className="flex h-12 items-center justify-between gap-3 border-b border-cb-line px-4 last:border-0"
              >
                <span className="min-w-0 truncate text-sm">{invite.email}</span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs capitalize text-cb-muted">{invite.role}</span>
                  {mayRevoke ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void revokeInvite(invite.id)}
                    >
                      {busy === `invite:${invite.id}` ? "Revoking…" : "Revoke"}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {isOwner ? (
        <form onSubmit={onSubmit} className="max-w-lg space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Invite account manager</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={!allowsMembers || atCap}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-role">Role</Label>
            <NativeSelect
              id="invite-role"
              value={role}
              onChange={(event) => setRole(event.target.value === "admin" ? "admin" : "member")}
              disabled={!allowsMembers || atCap}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </NativeSelect>
          </div>
          <p className="text-sm text-cb-muted">
            Owners invite as member or admin. Seat cap counts members and pending invites.
          </p>
          <Button type="submit" disabled={busy !== null || !allowsMembers || atCap}>
            {busy === "invite" ? "Inviting…" : "Send invite"}
          </Button>
          {message ? <p className="text-sm text-cb-muted">{message}</p> : null}
          {inviteLink ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="break-all text-xs text-cb-muted">{inviteLink}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => void copyLink()}>
                {copied ? "Copied" : "Copy invite link"}
              </Button>
            </div>
          ) : null}
        </form>
      ) : (
        <p className="text-sm text-cb-muted">
          Only a workspace owner can invite, remove, or revoke. Ask an owner if you need to leave.
        </p>
      )}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-cb-control border border-cb-line bg-cb-surface px-4 py-2 text-sm text-cb-text shadow-[var(--cb-shadow-menu)]"
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}
