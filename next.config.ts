import type { NextConfig } from "next";

// Build timestamp: 1769662200
const nextConfig: NextConfig = {
  // Increase body size limit for large chat exports
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
};

export default nextConfig;
