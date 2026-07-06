import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server output for a lightweight PM2 deploy on the VPS
  // (`node .next/standalone/server.js`). `next start` continues to work too.
  output: "standalone",
  // Pin the workspace root so Next doesn't get confused by sibling project
  // lockfiles in the parent directory.
  turbopack: { root: path.resolve(__dirname) },
  images: {
    // Allow local SVG placeholders and any remote host you later point images at.
    formats: ["image/avif", "image/webp"],
    dangerouslyAllowSVG: true,
    contentDispositionType: "inline",
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  /**
   * Cache policy — deploy changes appear INSTANTLY, without killing performance.
   *
   * Strategy (professional, not "disable everything"):
   *  1. `/_next/static/*` are content-hashed → a new build produces new
   *     filenames, so caching them forever is SAFE and never serves stale
   *     content. We keep them immutable for full performance.
   *  2. Every HTML/RSC/route response is served `no-store` so no browser, proxy,
   *     Nginx, or CDN ever hands back an old document. This overrides Next's
   *     default `s-maxage` full-route cache header that was causing stale pages.
   *
   * Net effect: assets stay fast, but the page itself is always fresh.
   */
  async headers() {
    return [
      {
        // Immutable, content-hashed build assets — cache forever (safe).
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        // Everything else (documents / RSC / routes) — never cached anywhere.
        // Negative lookahead excludes hashed assets & the image optimizer so
        // they are NOT force-revalidated (that would hurt performance).
        source: "/((?!_next/static|_next/image).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, max-age=0",
          },
          { key: "Pragma", value: "no-cache" },
          { key: "Expires", value: "0" },
        ],
      },
    ];
  },
};

export default nextConfig;
