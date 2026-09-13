type SendArgs = {
  to: string;
  subject: string;
  html: string;
  env: CloudflareEnv;
  /** Studio custom sender display name. Ignored unless customSender is true. */
  senderName?: string | null;
  senderDomain?: string | null;
  customSender?: boolean;
};

function isStubKey(value: string | undefined) {
  return !value || value === "stub" || value.startsWith("stub-");
}

export function resolveFromAddress(args: {
  env: CloudflareEnv;
  senderName?: string | null;
  senderDomain?: string | null;
  customSender?: boolean;
}): string {
  const fallback = args.env.RESEND_FROM ?? "CiteBrief <auth@getcitebrief.com>";
  if (!args.customSender) return fallback;
  const name = args.senderName?.trim();
  const domain = args.senderDomain?.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (name && domain && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
    return `${name} <reports@${domain}>`;
  }
  if (name) {
    const match = fallback.match(/<([^>]+)>/);
    const email = match?.[1] || "auth@getcitebrief.com";
    return `${name} <${email}>`;
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
  env,
  senderName,
  senderDomain,
  customSender,
}: SendArgs) {
  if (isStubKey(env.RESEND_API_KEY)) {
    console.info("[resend stub] skip send", { to, subject, senderName });
    return;
  }

  const from = resolveFromAddress({ env, senderName, senderDomain, customSender });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Resend failed: ${response.status} ${detail}`);
  }
}
