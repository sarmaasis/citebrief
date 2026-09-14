import { escapeHtml } from "./escape";
import { renderEmailLayout } from "./layout";

export function verifyEmail(args: { otp?: string; url?: string }) {
  const otp = args.otp?.replace(/\D/g, "").slice(0, 8);
  const bodyHtml = otp
    ? `<p style="margin:0 0 16px">Enter this code to confirm your email and open CiteBrief. It expires in 5 minutes.</p>
<p style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;line-height:1.2;letter-spacing:0.28em;font-weight:600">${escapeHtml(otp)}</p>`
    : `<p style="margin:0">Confirm this address to open your CiteBrief workspace and start the first Friday report.</p>`;

  return {
    subject: otp ? "Your CiteBrief verification code" : "Verify your CiteBrief email",
    ...renderEmailLayout({
      preheader: otp ? "Your 6-digit verification code." : "Confirm this address to open your workspace.",
      eyebrow: "Account",
      title: "Verify your email",
      bodyHtml,
      cta: args.url ? { href: args.url, label: otp ? "Enter the code" : "Verify email" } : undefined,
    }),
  };
}

export function magicLinkEmail(args: { url: string }) {
  return {
    subject: "Sign in to CiteBrief",
    ...renderEmailLayout({
      preheader: "One link to sign in. It expires after you use it.",
      eyebrow: "Sign in",
      title: "Sign in",
      bodyHtml: `<p style="margin:0">Use this link to sign in. It works once. If you did not ask for it, ignore this email.</p>`,
      cta: { href: args.url, label: "Sign in" },
    }),
  };
}
