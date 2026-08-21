import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The portal runs behind nginx on the shared domain; keep it self-contained.
  reactStrictMode: true,
};

export default nextConfig;
