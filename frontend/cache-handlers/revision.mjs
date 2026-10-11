// Keep Next's native storage and serialization; only coordinate freshness.
// These delegates are tied to the installed Next 16.3 API and integration-tested.
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { getPublicCacheConfig } from "../src/lib/cache-config.mjs";
import defaultHandler from "next/dist/server/lib/cache-handlers/default.js";

export const nativeCache = defaultHandler.createDefaultCacheHandler(
  50 * 1024 * 1024,
);
let revision;
let pending;

export function refreshRevision() {
  if (
    process.env.NEXT_PHASE === "phase-production-build" ||
    !getPublicCacheConfig().enabled
  )
    return Promise.resolve(true);
  if (pending) return pending;
  pending = (async () => {
    const api = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");
    if (!api)
      throw new Error("NEXT_PUBLIC_API_URL is required for cache freshness");
    // Cache infrastructure must bypass Next's instrumented application fetch:
    // entering that fetch from a cache lookup can recursively wait on itself.
    const url = new URL(`${api}/public-cache/revision`);
    const value = await new Promise((resolve, reject) => {
      const get = url.protocol === "https:" ? httpsGet : httpGet;
      const request = get(
        url,
        { signal: AbortSignal.timeout(3000) },
        (response) => {
          if (response.statusCode !== 200) {
            response.resume();
            reject(
              new Error(
                `Public cache revision returned ${response.statusCode}`,
              ),
            );
            return;
          }
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
            if (body.length > 4096)
              request.destroy(new Error("Public cache revision too large"));
          });
          response.on("error", reject);
          response.on("end", () => {
            try {
              resolve(JSON.parse(body));
            } catch (error) {
              reject(error);
            }
          });
        },
      );
      request.on("error", reject);
    });
    if (typeof value?.revision !== "string" || value.revision.length > 100) {
      throw new Error("Invalid public cache revision response");
    }
    if (revision !== value.revision) {
      const { namespace } = getPublicCacheConfig();
      // Also expire build-time entries on the first request after a restart.
      // The native handler and filesystem handler share Next's tag manifest.
      await nativeCache.updateTags([`${namespace}:content`, "_N_T_/layout"], {
        expire: 0,
      });
      revision = value.revision;
    }
    return true;
  })()
    .catch((error) => {
      // Freshness is unknown: bypass stored content and let React render its
      // loading/error states instead of failing before the page can render.
      console.warn(
        "Public cache freshness unavailable; bypassing cache",
        error,
      );
      return false;
    })
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
