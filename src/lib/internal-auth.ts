import type { NextResponse } from "next/server";
import { jsonError } from "@/server/json";

type EnvWithSecrets = CloudflareEnv & {
  INTERNAL_PROCESS_SECRET?: string;
  CRON_SECRET?: string;
  INTERNAL_ADMIN_SECRET?: string;
  NEXTJS_ENV?: string;
};

function isDev(env: EnvWithSecrets) {
  return env.NEXTJS_ENV === "development" || process.env.NODE_ENV === "development";
}

function bearerToken(request: Request) {
  const auth = request.headers.get("authorization");
  return auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
}

/**
 * Require Bearer secret for internal endpoints.
 * Rejects when secret is unset outside development.
 * INTERNAL_ADMIN_SECRET: in development, Bearer `dev-admin` is accepted when unset/stub.
 */
export function requireInternalSecret(
  request: Request,
  env: EnvWithSecrets,
  secretName: "INTERNAL_PROCESS_SECRET" | "CRON_SECRET" | "INTERNAL_ADMIN_SECRET",
): NextResponse | null {
  const secret = env[secretName]?.trim();
  const bearer = bearerToken(request);

  if (secretName === "INTERNAL_ADMIN_SECRET") {
    if (secret && secret !== "stub" && bearer === secret) return null;
    if (isDev(env) && bearer === "dev-admin") return null;
    if (!secret || secret === "stub") {
      return jsonError("INTERNAL_ADMIN_SECRET must be set (or Bearer dev-admin in development).", 503);
    }
    return jsonError("Unauthorized.", 401);
  }

  if (!secret || secret === "stub") {
    if (isDev(env)) return null;
    return jsonError(`${secretName} must be set outside development.`, 503);
  }

  if (bearer !== secret) {
    return jsonError("Unauthorized.", 401);
  }
  return null;
}
