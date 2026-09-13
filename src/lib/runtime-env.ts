import { isStubSecret } from "@/lib/billing";

type EnvLike = {
  NEXTJS_ENV?: string;
  BETTER_AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
  INTERNAL_ADMIN_SECRET?: string;
  INTERNAL_PROCESS_SECRET?: string;
  CRON_SECRET?: string;
  DODO_PAYMENTS_API_KEY?: string;
  DODO_PAYMENTS_WEBHOOK_KEY?: string;
};

export function isProductionRuntime(env?: EnvLike | null) {
  if (env?.NEXTJS_ENV === "production") return true;
  if (env?.NEXTJS_ENV === "development") return false;
  const origin = (env?.BETTER_AUTH_URL || "").toLowerCase();
  if (origin.includes("getcitebrief.com")) return true;
  return process.env.NODE_ENV === "production";
}

export function isDevRuntime(env?: EnvLike | null) {
  return !isProductionRuntime(env);
}

export function isForbiddenProductionSecret(value: string | undefined) {
  if (!value) return true;
  if (isStubSecret(value)) return true;
  if (value === "dev-admin") return true;
  if (value === "dev-only-replace-with-BETTER_AUTH_SECRET") return true;
  return false;
}

const PRODUCTION_SECRET_NAMES = [
  "BETTER_AUTH_SECRET",
  "INTERNAL_ADMIN_SECRET",
  "INTERNAL_PROCESS_SECRET",
  "CRON_SECRET",
] as const;

export function productionSecretProblems(env?: EnvLike | null): string[] {
  if (!isProductionRuntime(env) || !env) return [];
  return PRODUCTION_SECRET_NAMES.filter((name) => isForbiddenProductionSecret(env[name]));
}

export function productionBillingSecretProblems(env?: EnvLike | null): string[] {
  if (!isProductionRuntime(env) || !env) return [];
  return (["DODO_PAYMENTS_API_KEY", "DODO_PAYMENTS_WEBHOOK_KEY"] as const).filter((name) =>
    isForbiddenProductionSecret(env[name]),
  );
}

/** Auth/admin/cron stubs must not serve app traffic. Billing stubs fail closed on billing routes. */
export function productionTrafficBlocked(env?: EnvLike | null) {
  return productionSecretProblems(env).length > 0;
}

export function isHealthPath(pathname: string) {
  return pathname === "/api/health" || pathname === "/health";
}

export function logProductionSecretProblems(env?: EnvLike | null) {
  const problems = productionSecretProblems(env);
  const billing = productionBillingSecretProblems(env);
  if (problems.length) {
    console.error("[security] production refuses stub/dev-admin secrets", problems);
  }
  if (billing.length) {
    console.error("[security] production billing secrets missing or stub", billing);
  }
  return problems;
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function canonicalRedirectLocation(request: Request): string | null {
  const url = new URL(request.url);
  const host = url.hostname.toLowerCase();
  const redirectHosts = new Set(["citebrief.xyz", "www.citebrief.xyz", "www.getcitebrief.com"]);
  if (!redirectHosts.has(host)) return null;
  url.protocol = "https:";
  url.hostname = "getcitebrief.com";
  url.port = "";
  return url.toString();
}
