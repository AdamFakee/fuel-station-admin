import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${process.env.BACKEND_URL ?? "http://127.0.0.1:8080"}/v1/:path*`,
      },
    ];
  },
  experimental: {
    optimizePackageImports: [
      "@heroicons/react/24/outline",
      "@heroicons/react/24/solid",
      "lucide-react",
      "recharts",
    ],
  },
};

export default nextConfig;
