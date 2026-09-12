import { isStubSecret } from "@/lib/billing";

const COOKIE = "cb_act_as_workspace";

async function hmacSign(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function actAsCookieName() {
  return COOKIE;
}

export async function buildActAsCookieValue(workspaceId: string, secret: string) {
  const sig = await hmacSign(secret, workspaceId);
  return `${workspaceId}.${sig}`;
}

export async function parseActAsCookieValue(
  raw: string | null | undefined,
  secret: string | undefined,
): Promise<string | null> {
  if (!raw || !secret || isStubSecret(secret)) return null;
  const [workspaceId, sig] = raw.split(".");
  if (!workspaceId || !sig) return null;
  const expected = await hmacSign(secret, workspaceId);
  if (expected !== sig) return null;
  return workspaceId;
}

export function readActAsFromRequest(request: Request): string | null {
  const header = request.headers.get("x-citebrief-act-as-workspace")?.trim();
  if (header) return header;
  return null;
}
