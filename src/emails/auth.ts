import { renderEmailLayout } from "./layout";

export function verifyEmail(args: { url: string }) {
  return {
    subject: "Verify your CiteBrief email",
    ...renderEmailLayout({
      preheader: "Confirm this address to open your workspace.",
      eyebrow: "Account",
      title: "Verify your email",
      bodyHtml: `<p style="margin:0">Confirm this address to open your CiteBrief workspace and start the first Friday report.</p>`,
      cta: { href: args.url, label: "Verify email" },
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
