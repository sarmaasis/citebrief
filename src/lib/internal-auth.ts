import type { NextResponse } from "next/server";
import { jsonError } from "@/server/json";

type EnvWithSecrets = CloudflareEnv & {
  INTERNAL_PROCESS_SECRET?: string;
  CRON_SECRET?: string;
  NEXTJS_ENV?: string;
};

function isDev(env: EnvWithSecrets) {
  return env.NEXTJS_ENV === "development" || process.env.NODE_ENV === "development";
}

/**
 * Require Bearer secret for internal endpoints.
 * Rejects when secret is unset outside development.
 */
export function requireInternalSecret(
  request: Request,
  env: EnvWithSecrets,
  secretName: "INTERNAL_PROCESS_SECRET" | "CRON_SECRET",
): NextResponse | null {
  const secret = env[secretName]?.trim();
  const auth = request.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;

  if (!secret || secret === "stub") {
    if (isDev(env)) {
      return null;
    }
    return jsonError(`${secretName} must be set outside development.`, 503);
  }

  if (bearer !== secret) {
    return jsonError("Unauthorized.", 401);
  }
  return null;
}
