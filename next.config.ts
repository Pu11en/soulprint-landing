import type { NextConfig } from "next";

// Build timestamp: 1769662200
const nextConfig: NextConfig = {
  // Increase body size limit for large chat exports
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // unsafe-inline needed for Next.js
              "style-src 'self' 'unsafe-inline'",  // unsafe-inline needed for Tailwind
              "img-src 'self' data: blob: https:",  // Allow external images
              "font-src 'self' data:",
              "connect-src 'self' https://swvljsixpvvcirjmflze.supabase.co https://soulprint-landing.onrender.com https://*.upstash.io",  // Supabase + RLM + Upstash
              "frame-ancestors 'none'",  // Redundant with X-Frame-Options but belt-and-suspenders
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
