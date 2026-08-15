import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    cssChunking: "strict",
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
