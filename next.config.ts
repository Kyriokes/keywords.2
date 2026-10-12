import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Los navegadores lo ignoran sobre http, así que no afecta el desarrollo local
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  // CSP acotada a directivas que no dependen de nonces: no restringe scripts ni estilos
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf2json"],
  turbopack: {},
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
