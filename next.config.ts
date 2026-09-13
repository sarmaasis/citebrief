import type { NextConfig } from "next";
import { SECURITY_HEADER_LIST } from "./src/lib/security-headers";

const nextConfig: NextConfig = {
  agentRules: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADER_LIST,
      },
    ];
  },
};

export default nextConfig;

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

void initOpenNextCloudflareForDev();
