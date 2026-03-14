import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf2json"],
  turbopack: {},
  devIndicators: false,
};

export default nextConfig;
