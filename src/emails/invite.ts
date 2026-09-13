import { escapeHtml } from "./escape";
import { renderEmailLayout } from "./layout";

export function inviteEmail(args: { workspaceName: string; role: string; acceptUrl: string }) {
  const role = args.role.trim() || "member";
  return {
    subject: `Join ${args.workspaceName} on CiteBrief`,
    ...renderEmailLayout({
      preheader: `You were invited to ${args.workspaceName} as ${role}.`,
      eyebrow: "Workspace invite",
      title: `Join ${args.workspaceName}`,
      bodyHtml: `<p style="margin:0 0 12px">You were invited to <strong>${escapeHtml(args.workspaceName)}</strong> as ${escapeHtml(role)}.</p><p style="margin:0">Accept the invite to open Friday reports for this workspace.</p>`,
      cta: { href: args.acceptUrl, label: "Accept invite" },
    }),
  };
}
