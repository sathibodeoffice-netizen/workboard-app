import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["mongodb"],
  webpack: (config) => {
    config.externals = [...(config.externals || []), "mongodb"];
    return config;
  },
};

export default nextConfig;
