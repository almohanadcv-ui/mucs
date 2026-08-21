import type { NextConfig } from "next";

// Same-origin proxy so each system renders INSIDE the portal (embeddable). Each
// system is reachable at /apps/<key>/* on the portal's own origin, which also
// satisfies X-Frame-Options: SAMEORIGIN. On the server these point at the
// systems' internal URLs; locally at their dev ports.
const SYS = {
  evaluation: process.env.SYS_EVALUATION_URL || "http://localhost:3000",
  gatepass: process.env.SYS_GATEPASS_URL || "http://localhost:4000",
  mica: process.env.SYS_MICA_URL || "http://localhost:3002",
  tasks: process.env.SYS_TASKS_URL || "http://localhost:5173",
  tickets: process.env.SYS_TICKETS_URL || "http://localhost:5174",
};

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return Object.entries(SYS).map(([key, url]) => ({
      source: `/apps/${key}/:path*`,
      destination: `${url.replace(/\/$/, "")}/:path*`,
    }));
  },
};

export default nextConfig;
