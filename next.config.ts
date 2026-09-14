import type { NextConfig } from "next";
import { securityHeaderList } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaderList(),
      },
    ];
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Only for `next dev`. During `next build` / OpenNext CI, wrangler would open a
// remote proxy for always-remote bindings (e.g. AI) and require CLOUDFLARE_API_TOKEN.
if (process.env.NODE_ENV === "development") {
  void initOpenNextCloudflareForDev();
}
