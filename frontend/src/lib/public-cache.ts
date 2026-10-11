import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { API_URL } from "./api-url";
import { getPublicCacheConfig } from "./cache-config.mjs";

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`API returned ${status} for ${url}`);
  }
}

async function readJson(
  url: string,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  // Keep expected missing-detail results distinct from an upstream outage.
  if (response.status === 404) return { status: 404, body: null };
  if (!response.ok)
    throw new Error(`API returned ${response.status} for ${url}`);
  return { status: response.status, body: await response.json() };
}

async function cachedJson(url: string, tag: string, ttlSeconds: number) {
  "use cache";
  cacheTag(tag);
  cacheLife({ revalidate: ttlSeconds, expire: Math.max(ttlSeconds + 1, 300) });
  try {
    return await readJson(url);
  } catch (error) {
    // Throwing during a cache fill can fail Next's prerender before the caller
    // handles it. Carry the failure outside the cache without storing it.
    cacheLife({ stale: 0, revalidate: 0, expire: 0 });
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function publicJson<T>(
  path: string,
  live = false,
  maxTtlSeconds?: number,
): Promise<T> {
  const config = getPublicCacheConfig();
  const url = `${API_URL}${path}`;
  let result;
  if (!config.enabled || live) {
    await connection();
    result = await readJson(url);
  } else {
    result = await cachedJson(
      url,
      config.tag,
      Math.min(config.ttlSeconds, maxTtlSeconds ?? config.ttlSeconds),
    );
  }
  if ("error" in result) throw new Error(result.error);
  if (result.status === 404) throw new PublicApiError(404, url);
  return result.body as T;
}
