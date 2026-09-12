type SendArgs = {
  to: string;
  subject: string;
  html: string;
  env: CloudflareEnv;
};

function isStubKey(value: string | undefined) {
  return !value || value === "stub" || value.startsWith("stub-");
}

export async function sendTransactionalEmail({ to, subject, html, env }: SendArgs) {
  if (isStubKey(env.RESEND_API_KEY)) {
    console.info("[resend stub] skip send", { to, subject });
    return;
  }

  const from = env.RESEND_FROM ?? "CiteBrief <auth@getcitebrief.com>";
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
