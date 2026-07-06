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
};

export default nextConfig;
