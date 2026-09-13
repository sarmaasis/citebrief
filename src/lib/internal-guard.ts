import type { NextResponse } from "next/server";
import { requireInternalSecret } from "@/lib/internal-auth";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function guardInternalRoute(
  request: Request,
  env: CloudflareEnv,
  secretName: "INTERNAL_PROCESS_SECRET" | "CRON_SECRET" | "INTERNAL_ADMIN_SECRET",
): Promise<NextResponse | null> {
  const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.internal);
  if (limited) return limited;
  return requireInternalSecret(request, env, secretName);
}
