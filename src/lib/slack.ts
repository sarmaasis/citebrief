import { isStubSecret } from "@/lib/billing";

export async function postSlackIncomingWebhook(args: {
  webhookUrl: string | null | undefined;
  text: string;
}): Promise<{ ok: boolean; stubbed: boolean }> {
  const url = args.webhookUrl?.trim();
  if (!url || isStubSecret(url) || !url.startsWith("https://hooks.slack.com/")) {
    console.info("[slack stub] skip post", { text: args.text.slice(0, 120) });
    return { ok: true, stubbed: true };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: args.text }),
    });
    if (!response.ok) {
      const detail = await response.text();
      console.info("[slack] webhook failed", response.status, detail.slice(0, 200));
      return { ok: false, stubbed: false };
    }
    return { ok: true, stubbed: false };
  } catch (error) {
    console.info("[slack] webhook error", error);
    return { ok: false, stubbed: false };
  }
}
