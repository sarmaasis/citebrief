import type { NextResponse } from "next/server";
import { jsonError } from "@/server/json";
import { isDevRuntime, isForbiddenProductionSecret } from "@/lib/runtime-env";

type EnvWithSecrets = CloudflareEnv & {
  INTERNAL_PROCESS_SECRET?: string;
  CRON_SECRET?: string;
  INTERNAL_ADMIN_SECRET?: string;
  NEXTJS_ENV?: string;
};

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

/**
 * Require Bearer secret for internal endpoints.
 * Production never accepts unset, stub, or `dev-admin` secrets.
 * Development may use Bearer `dev-admin` when INTERNAL_ADMIN_SECRET is unset.
 */
export function requireInternalSecret(
  request: Request,
  env: EnvWithSecrets,
  secretName: "INTERNAL_PROCESS_SECRET" | "CRON_SECRET" | "INTERNAL_ADMIN_SECRET",
): NextResponse | null {
  const secret = env[secretName]?.trim();
  const bearer = bearerToken(request);
  const production = !isDevRuntime(env);

  if (production && isForbiddenProductionSecret(secret)) {
    return jsonError(`${secretName} must be set to a non-stub value in production.`, 503);
  }

  if (secretName === "INTERNAL_ADMIN_SECRET") {
    if (secret && !isForbiddenProductionSecret(secret) && bearer === secret) return null;
    if (!production && bearer === "dev-admin") return null;
    if (!secret || isForbiddenProductionSecret(secret)) {
      return jsonError("INTERNAL_ADMIN_SECRET must be set (or Bearer dev-admin in development).", 503);
    }
    return jsonError("Unauthorized.", 401);
  }

  if (!secret || isForbiddenProductionSecret(secret)) {
    if (!production) return null;
    return jsonError(`${secretName} must be set outside development.`, 503);
  }

  if (bearer !== secret) {
    return jsonError("Unauthorized.", 401);
  }
  return null;
}
