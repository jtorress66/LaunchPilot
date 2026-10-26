import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Linting runs once for the whole monorepo via `pnpm lint`.
  eslint: { ignoreDuringBuilds: true },
  transpilePackages: [
    "@nuvantre/domain",
    "@nuvantre/ports",
    "@nuvantre/application",
    "@nuvantre/agents",
    "@nuvantre/adapters",
  ],
  headers: () =>
    Promise.resolve([
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ]),
};

export default config;
