import { escapeHtml } from "./escape";
import { renderEmailLayout } from "./layout";

export function dunningEmail(args: { workspaceName: string; billingUrl?: string }) {
  const name = escapeHtml(args.workspaceName);
  return {
    subject: "CiteBrief billing needs attention",
    ...renderEmailLayout({
      preheader: `We could not renew CiteBrief for ${args.workspaceName}.`,
      eyebrow: "Billing",
      title: "Update billing to keep Friday reports",
      bodyHtml: `<p style="margin:0 0 12px">We could not renew CiteBrief for <strong>${name}</strong>.</p><p style="margin:0">Update the payment method to keep Friday reports running. PDFs stay available for 90 days if the subscription ends.</p>`,
      cta: args.billingUrl ? { href: args.billingUrl, label: "Update billing" } : undefined,
    }),
  };
}

export function deletionSupportEmail(args: { ownerEmail: string; workspaceId: string; workspaceName: string }) {
  return {
    subject: `Deletion request: ${args.workspaceName}`,
    ...renderEmailLayout({
      preheader: `${args.ownerEmail} requested deletion of ${args.workspaceName}.`,
      eyebrow: "Support",
      title: "Workspace deletion request",
      bodyHtml: `<p style="margin:0">${escapeHtml(args.ownerEmail)} requested deletion of workspace ${escapeHtml(args.workspaceId)} (${escapeHtml(args.workspaceName)}).</p>`,
    }),
  };
}

export function deletionOwnerEmail(args: { workspaceName: string; settingsUrl?: string }) {
  const name = escapeHtml(args.workspaceName);
  return {
    subject: "CiteBrief deletion request received",
    ...renderEmailLayout({
      preheader: `We received your request to delete ${args.workspaceName}.`,
      eyebrow: "Account",
      title: "Deletion request received",
      bodyHtml: `<p style="margin:0">We received your request to delete <strong>${name}</strong>. Support will confirm once workspace data is removed. Export a copy first from Settings if you still need it.</p>`,
      cta: args.settingsUrl ? { href: args.settingsUrl, label: "Open settings" } : undefined,
    }),
  };
}
