import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["mongoose"],
  webpack: (config) => {
    config.externals = [...(config.externals || []), "mongoose"];
    return config;
  },
};

export default nextConfig;
