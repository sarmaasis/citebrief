type HeaderEnv = {
  NEXTJS_ENV?: string;
  BETTER_AUTH_URL?: string;
};

export type SecurityHeaderOptions = {
  /** True for http://localhost (or any request that must not upgrade CSS/JS to HTTPS). */
  allowInsecureLocal?: boolean;
  requestUrl?: string | null;
};

/** Local check only — this file is imported by next.config.ts and cannot pull app modules. */
function isProductionCsp(env?: HeaderEnv | null) {
  const nextjs = env?.NEXTJS_ENV || process.env.NEXTJS_ENV;
  if (nextjs === "production") return true;
  if (nextjs === "development") return false;
  if (process.env.NODE_ENV === "development") return false;
  const origin = (env?.BETTER_AUTH_URL || process.env.BETTER_AUTH_URL || "").toLowerCase();
  if (origin.includes("getcitebrief.com")) return true;
  return process.env.NODE_ENV === "production";
}

export function isInsecureLocalUrl(url?: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host === "::1" ||
      host.endsWith(".localhost")
    ) {
      return true;
    }
    return parsed.protocol === "http:";
  } catch {
    return /localhost|127\.0\.0\.1/i.test(url);
  }
}

export function shouldUpgradeInsecureRequests(opts: {
  production: boolean;
  allowInsecureLocal?: boolean;
  requestUrl?: string | null;
}): boolean {
  if (opts.allowInsecureLocal) return false;
  if (opts.requestUrl && isInsecureLocalUrl(opts.requestUrl)) return false;
  return opts.production;
}

/**
 * Next/OpenNext emits inline hydration scripts and styles without a nonce
 * hook on this Worker, so `unsafe-inline` stays. React Fast Refresh / Turbopack
 * need `unsafe-eval` in development only. Production never includes it.
 *
 * `upgrade-insecure-requests` is omitted on localhost / HTTP. Safari upgrades
 * CSS/JS to https://localhost and the page renders unstyled.
 */
export function contentSecurityPolicy(opts: { production: boolean; allowInsecureLocal?: boolean }): string {
  const scriptSrc = opts.production
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";
  const upgrade = shouldUpgradeInsecureRequests({
    production: opts.production,
    allowInsecureLocal: opts.allowInsecureLocal,
  });

  return [
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
    upgrade ? "upgrade-insecure-requests" : null,
  ]
    .filter((directive): directive is string => Boolean(directive))
    .join("; ");
}

export function securityHeaders(
  env?: HeaderEnv | null,
  options?: SecurityHeaderOptions,
): Record<string, string> {
  const production = isProductionCsp(env);
  const allowInsecureLocal =
    options?.allowInsecureLocal === true ||
    (options?.requestUrl ? isInsecureLocalUrl(options.requestUrl) : false);

  return {
    "Content-Security-Policy": contentSecurityPolicy({ production, allowInsecureLocal }),
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy":
      "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-DNS-Prefetch-Control": "off",
  };
}

/** next.config.ts: never emit upgrade-insecure-requests (HTTP localhost / Safari). */
export function securityHeaderList(env?: HeaderEnv | null) {
  return Object.entries(securityHeaders(env, { allowInsecureLocal: true })).map(([key, value]) => ({
    key,
    value,
  }));
}

export const SECURITY_HEADERS = securityHeaders(undefined, { allowInsecureLocal: true });
export const SECURITY_HEADER_LIST = securityHeaderList();

export function applySecurityHeaders(
  response: Response,
  env?: HeaderEnv | null,
  request?: Request,
): Response {
  const headers = new Headers(response.headers);
  const computed = securityHeaders(env, {
    allowInsecureLocal: request ? isInsecureLocalUrl(request.url) : true,
    requestUrl: request?.url,
  });
  for (const [key, value] of Object.entries(computed)) {
    if (key === "Content-Security-Policy") {
      headers.set(key, value);
      continue;
    }
    if (!headers.has(key)) headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function canonicalRedirectResponse(
  location: string,
  env?: HeaderEnv | null,
  request?: Request,
): Response {
  const headers = new Headers({ Location: location });
  const computed = securityHeaders(env, {
    allowInsecureLocal: request ? isInsecureLocalUrl(request.url) : true,
    requestUrl: request?.url,
  });
  for (const [key, value] of Object.entries(computed)) {
    headers.set(key, value);
  }
  return new Response(null, { status: 301, headers });
}
