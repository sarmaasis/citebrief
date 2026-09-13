import { initAuth } from "@/auth";
import { consumeRouteRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getCloudflareContext } from "@opennextjs/cloudflare";

async function handler(request: Request) {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const limited = await consumeRouteRateLimit(request, env, RATE_LIMITS.auth);
    if (limited) return limited;
  } catch {
    // Local Next without Cloudflare context still serves auth.
  }
  const auth = await initAuth();
  return auth.handler(request);
}

export const GET = handler;
export const POST = handler;
