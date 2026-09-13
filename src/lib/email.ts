import { htmlToText } from "@/emails/escape";
import { isProductionRuntime } from "@/lib/runtime-env";

export const DEFAULT_FROM = "CiteBrief <auth@getcitebrief.com>";

export type EmailSendAction = "send" | "stub" | "fail";

export type EmailAddressValue = string | { email: string; name?: string };

/** Structured send() payload used by Cloudflare Email Service. */
export type CloudflareEmailPayload = {
  to: EmailAddressValue | EmailAddressValue[];
  from: EmailAddressValue;
  subject: string;
  html?: string;
  text?: string;
  cc?: EmailAddressValue | EmailAddressValue[];
  replyTo?: EmailAddressValue;
};

export type CloudflareEmailBinding = {
  send(message: CloudflareEmailPayload): Promise<{ messageId?: string } | void>;
};

type EmailEnv = {
  EMAIL?: CloudflareEmailBinding;
  CF_EMAIL_FROM?: string;
  NEXTJS_ENV?: string;
  BETTER_AUTH_URL?: string;
};

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  env: EmailEnv;
  /** Studio custom sender display name. Ignored unless customSender is true. */
  senderName?: string | null;
  senderDomain?: string | null;
  customSender?: boolean;
};

export function isEmailBindingReady(env?: EmailEnv | null): boolean {
  return typeof env?.EMAIL?.send === "function";
}

/** Production without a send_email binding must not pretend the mail went out. */
export function emailSendDecision(env?: EmailEnv | null): { action: EmailSendAction; error?: string } {
  if (isEmailBindingReady(env)) return { action: "send" };
  if (isProductionRuntime(env)) {
    return { action: "fail", error: "Cloudflare Email binding is missing in production." };
  }
  return { action: "stub" };
}

export function parseFromAddress(value: string): { email: string; name?: string } {
  const match = value.trim().match(/^(.*)<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return name ? { name, email: match[2].trim() } : { email: match[2].trim() };
  }
  return { email: value.trim() };
}

export function resolveFromAddress(args: {
  env: EmailEnv;
  senderName?: string | null;
  senderDomain?: string | null;
  customSender?: boolean;
}): string {
  const fallback = args.env.CF_EMAIL_FROM?.trim() || DEFAULT_FROM;
  if (!args.customSender) return fallback;
  const name = args.senderName?.trim();
  const domain = args.senderDomain?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (name && domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return `${name} <reports@${domain}>`;
  }
  if (name) {
    const parsed = parseFromAddress(fallback);
    return `${name} <${parsed.email}>`;
  }
  return fallback;
}

export function isValidSenderDomain(value: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
    value.trim(),
  );
}

export async function sendTransactionalEmail({
  to,
  subject,
  html,
  text,
  env,
  senderName,
  senderDomain,
  customSender,
}: SendArgs): Promise<{ ok: true; stubbed?: boolean; messageId?: string }> {
  const decision = emailSendDecision(env);
  if (decision.action === "fail") {
    throw new Error(decision.error);
  }
  if (decision.action === "stub") {
    console.info("[email stub] skip send (no EMAIL binding)", { to, subject, senderName });
    return { ok: true, stubbed: true };
  }

  const from = parseFromAddress(resolveFromAddress({ env, senderName, senderDomain, customSender }));
  const result = await env.EMAIL!.send({
    to,
    from,
    subject,
    html,
    text: text || htmlToText(html),
  });
  return { ok: true, messageId: result && "messageId" in result ? result.messageId : undefined };
}
