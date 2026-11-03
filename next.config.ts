import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
