import { afterEach, describe, expect, it, vi } from "vitest";

const originalApiUrl = process.env.API_URL;

afterEach(() => {
  if (originalApiUrl === undefined) {
    delete process.env.API_URL;
  } else {
    process.env.API_URL = originalApiUrl;
  }
  vi.resetModules();
});

describe("Next.js image configuration", () => {
  it("allows assets served by the configured API", async () => {
    process.env.API_URL = "https://api.example.test:8443/v1/api/";
    vi.resetModules();

    const { default: config } = await import("../next.config");

    expect(config.env?.API_URL).toBe("https://api.example.test:8443/v1/api/");
    expect(await config.rewrites?.()).toEqual([
      {
        source: "/api/assets/:id",
        destination: "https://api.example.test:8443/v1/api/assets/:id",
      },
    ]);
    expect(config.images?.remotePatterns).toEqual([
      {
        protocol: "https",
        hostname: "api.example.test",
        port: "8443",
        pathname: "/v1/api/assets/**",
      },
    ]);
  });
});
