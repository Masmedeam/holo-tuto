import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["ws"],
  poweredByHeader: false,
  async headers() {
    return [{
      source: "/",
      headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0, must-revalidate" }]
    }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb"
    }
  }
};

export default nextConfig;
