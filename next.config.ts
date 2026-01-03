import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf2json"],
  turbopack: {},
};

export default nextConfig;
