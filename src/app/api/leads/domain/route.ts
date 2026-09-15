import { getAppContext } from "@/lib/session";
import { jsonError, jsonOk } from "@/server/json";

export const dynamic = "force-dynamic";

function parseDomain(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  try {
    const withProto = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProto);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    if (!host || !host.includes(".")) return null;
    return host;
  } catch {
    return null;
  }
}

/** Stash lead fields into signup/onboarding query; signed-in users go straight to onboarding. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, string | undefined>;
  const domain = parseDomain(body.domain || "");
  if (!domain) return jsonError("Enter a client domain like northstar.app.");

  const competitors = (body.competitors || "")
    .split(/[,;\n]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (competitors.length < 1) return jsonError("Add at least one competitor.");

  const market = (body.market || "US").trim().slice(0, 40) || "US";
  const email = (body.email || "").trim().toLowerCase();
  const ctx = await getAppContext();

  if (ctx) {
    const qs = new URLSearchParams({ new: "1", siteUrl: domain, competitors: competitors.join(", "), market });
    return jsonOk({
      href: `/app/onboarding?${qs.toString()}`,
      message: "You’ll have a brief.",
    });
  }

  if (!email || !email.includes("@")) {
    return jsonError("Enter a work email.");
  }
  const qs = new URLSearchParams({
    email,
    plan: "agency",
    domain,
    competitors: competitors.join(", "),
    market,
  });
  return jsonOk({
    href: `/signup?${qs.toString()}`,
    message: "You’ll have a brief. We email this address.",
  });
}
