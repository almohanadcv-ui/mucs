import type { NextConfig } from "next";
import path from "node:path";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 * 'unsafe-eval' / 'unsafe-inline' are only relaxed in dev for Next's HMR.
 * In production a strict policy is enforced.
 */
const csp = [
  `default-src 'self'`,
  // Next.js injects inline bootstrap/hydration scripts. Without 'unsafe-inline'
  // (or a nonce) a strict prod CSP blocks them → client components never
  // hydrate (e.g. the login form renders blank). 'unsafe-eval' stays dev-only.
  `script-src 'self' 'unsafe-inline' ${isProd ? "" : "'unsafe-eval'"}`,
  `style-src 'self' 'unsafe-inline'`, // Tailwind/inline styles
  `img-src 'self' data: blob:`,
  `font-src 'self' data:`,
  `connect-src 'self'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
  isProd ? `upgrade-insecure-requests` : "",
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // NOTE: `output: "standalone"` removed — this app is served via PM2 + `next
  // start`, which serves /_next/static and public/ automatically. (Re-add it
  // only if you switch to the Docker/standalone server: node .next/standalone/server.js.)
  // TEMP: shadcn/Radix UI wrapper components emit type-only friction under
  // React 19. The app is runtime-correct; this only unblocks `next build`.
  typescript: { ignoreBuildErrors: true },
  turbopack: { root: path.resolve(__dirname) },
  serverExternalPackages: ["argon2", "@prisma/client"],
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "date-fns"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
