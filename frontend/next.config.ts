import type { NextConfig } from "next";

const apiUrl = new URL(
  process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001/api",
);
const apiPath = apiUrl.pathname.replace(/\/+$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  cacheHandler: require.resolve("./cache-handlers/route.mjs"),
  cacheHandlers: { default: require.resolve("./cache-handlers/native.mjs") },
  async headers() {
    // Requests must reach the revision check rather than an independent HTML CDN.
    return [
      "/",
      "/about",
      "/people/:path*",
      "/departments/:path*",
      "/papers/:path*",
      "/datasets/:path*",
      "/projects/:path*",
      "/open-positions/:path*",
    ].map((source) => ({
      source,
      headers: [{ key: "CDN-Cache-Control", value: "no-store" }],
    }));
  },
  images: {
    remotePatterns: [
      {
        protocol: apiUrl.protocol === "http:" ? "http" : "https",
        hostname: apiUrl.hostname,
        ...(apiUrl.port ? { port: apiUrl.port } : {}),
        pathname: `${apiPath}/assets/**`,
      },
    ],
  },
};

export default nextConfig;
