type HeaderEnv = {
  NEXTJS_ENV?: string;
  BETTER_AUTH_URL?: string;
};

/** Local check only — this file is imported by next.config.ts and cannot pull app modules. */
function isProductionCsp(env?: HeaderEnv | null) {
  const nextjs = env?.NEXTJS_ENV || process.env.NEXTJS_ENV;
  if (nextjs === "production") return true;
  if (nextjs === "development") return false;
  const origin = (env?.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "").toLowerCase();
  if (origin.includes("getcitebrief.com")) return true;
  return process.env.NODE_ENV === "production";
}

/**
 * Next/OpenNext emits inline hydration scripts and styles without a nonce
 * hook on this Worker, so `unsafe-inline` stays. React Fast Refresh / Turbopack
 * need `unsafe-eval` in development only. Production never includes it.
 */
export function securityHeaders(env?: HeaderEnv | null): Record<string, string> {
  const production = isProductionCsp(env);
  const scriptSrc = production
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com https://checkout.dodopayments.com https://*.dodopayments.com",
      "frame-ancestors 'none'",
      "object-src 'none'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "frame-src 'self' https://accounts.google.com https://checkout.dodopayments.com https://*.dodopayments.com",
      "worker-src 'self' blob:",
      "upgrade-insecure-requests",
    ].join("; "),
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-DNS-Prefetch-Control": "off",
  };
}

export function securityHeaderList(env?: HeaderEnv | null) {
  return Object.entries(securityHeaders(env)).map(([key, value]) => ({
    key,
    value,
  }));
}

export const SECURITY_HEADERS = securityHeaders();
export const SECURITY_HEADER_LIST = securityHeaderList();

export function applySecurityHeaders(response: Response, env?: HeaderEnv | null): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(securityHeaders(env))) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function canonicalRedirectResponse(location: string, env?: HeaderEnv | null): Response {
  const headers = new Headers({ Location: location });
  for (const [key, value] of Object.entries(securityHeaders(env))) {
    headers.set(key, value);
  }
  return new Response(null, { status: 301, headers });
}
