// Keep Next's native storage and serialization; only coordinate freshness.
// These delegates are tied to the installed Next 16.3 API and integration-tested.
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import {
  getPublicCacheConfig,
  PUBLIC_CACHE_SCOPES,
  publicCacheScopes,
} from "../src/lib/cache-config.mjs";
import defaultHandler from "next/dist/server/lib/cache-handlers/default.js";

export const nativeCache = defaultHandler.createDefaultCacheHandler(
  50 * 1024 * 1024,
);
let revision;
let pending;

export function refreshRevision() {
  if (!getPublicCacheConfig().enabled) return Promise.resolve(true);
  if (pending) return pending;
  pending = (async () => {
    const api = process.env.API_URL?.replace(/\/+$/, "");
    if (!api) throw new Error("API_URL is required for cache freshness");
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
    const scopes = value.scopes ?? { content: value.revision };
    for (const scope of PUBLIC_CACHE_SCOPES) {
      if (
        scopes[scope] !== undefined &&
        (typeof scopes[scope] !== "string" || scopes[scope].length > 100)
      ) {
        throw new Error("Invalid scoped public cache revision");
      }
    }
    if (typeof scopes.content !== "string")
      throw new Error("Missing public cache content revision");
    const { namespace } = getPublicCacheConfig();
    // A cold instance validates persisted generation tags instead of expiring
    // every layout merely because it has no in-memory revision yet.
    const changed = revision
      ? PUBLIC_CACHE_SCOPES.filter(
          (scope) =>
            (revision[scope] ?? "initial") !== (scopes[scope] ?? "initial"),
        )
      : [];
    if (changed.length)
      await nativeCache.updateTags(
        changed.map((scope) => `${namespace}:${scope}`),
        { expire: 0 },
      );
    revision = scopes;
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

export async function revisionTags(path) {
  if (!(await refreshRevision()))
    throw new Error("Public cache freshness unavailable");
  const { namespace } = getPublicCacheConfig();
  const scopes = [...new Set(["content", ...publicCacheScopes(path)])];
  return scopes.flatMap((scope) => [
    `${namespace}:${scope}`,
    `${namespace}:revision:${scope}:${revision?.[scope] ?? "initial"}`,
  ]);
}

export function tagsCurrent(tags) {
  const { namespace } = getPublicCacheConfig();
  return PUBLIC_CACHE_SCOPES.every((scope) => {
    if (!tags.includes(`${namespace}:${scope}`)) return true;
    const prefix = `${namespace}:revision:${scope}:`;
    const current = `${prefix}${revision?.[scope] ?? "initial"}`;
    return (
      tags.includes(current) &&
      tags.every((tag) => !tag.startsWith(prefix) || tag === current)
    );
  });
}
