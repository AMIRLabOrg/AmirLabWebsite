import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import nativeHandler from "../cache-handlers/native.mjs";
import { nativeCache } from "../cache-handlers/revision.mjs";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const env = {};
const calls = [];
const policies = [];
const tags = [];
let status = 200;
let fail = false;
let connections = 0;
function load(path, imports) {
  const exports = {};
  const code = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      assert.ok(name in imports, `Unexpected import ${name}`);
      return imports[name];
    },
    process: { env },
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (fail) throw new Error("upstream offline");
      return new Response(JSON.stringify({ value: "published" }), { status });
    },
    AbortSignal,
    Buffer,
    Response,
  });
  return exports;
}
const settings = load("../src/lib/cache-config.mjs", {});
const cache = load("../src/lib/public-cache.ts", {
  "server-only": {},
  "./cache-config.mjs": settings,
  "./api-url": { API_URL: "https://api.example.test/api" },
  "next/cache": {
    cacheLife: (policy) => policies.push(policy),
    cacheTag: (tag) => tags.push(tag),
  },
  "next/server": {
    connection: async () => {
      connections++;
    },
  },
});
assert.equal(settings.getPublicCacheConfig().enabled, true);
env.PUBLIC_CACHE_ENABLED = "false";
await cache.publicJson("/people");
assert.equal(connections, 1);
assert.equal(calls.at(-1).options.cache, "no-store");
assert.equal(policies.length, 0);
env.PUBLIC_CACHE_ENABLED = "true";
env.PUBLIC_CACHE_TTL_SECONDS = "7200";
env.PUBLIC_CACHE_NAMESPACE = "vps-test-v1";
const data = await cache.publicJson("/research?type=PAPER");
assert.equal(data.value, "published");
assert.equal(
  calls.at(-1).url,
  "https://api.example.test/api/research?type=PAPER",
);
assert.equal(calls.at(-1).options.cache, "no-store");
assert.equal(policies.at(-1).revalidate, 7200);
assert.equal(connections, 1, "enabled public reads must allow prerendering");
assert.equal(tags.at(-1), "vps-test-v1:content");
await cache.publicJson("/stats", false, 60);
assert.equal(policies.at(-1).revalidate, 60);
const beforeLive = policies.length;
const beforeLiveConnections = connections;
await cache.publicJson("/positions", true);
assert.equal(policies.length, beforeLive);
assert.equal(connections, beforeLiveConnections + 1);
status = 404;
await assert.rejects(
  cache.publicJson("/people/missing"),
  (error) => error instanceof cache.PublicApiError && error.status === 404,
);
status = 500;
await assert.rejects(cache.publicJson("/people"), /API returned 500/);
assert.equal(
  policies.at(-1).expire,
  0,
  "upstream failures must not enter reusable cache entries",
);
fail = true;
await assert.rejects(cache.publicJson("/people"), /offline/);
assert.equal(
  policies.at(-1).expire,
  0,
  "network failures must not enter reusable cache entries",
);
for (const [key, value] of [
  ["PUBLIC_CACHE_ENABLED", "yes"],
  ["PUBLIC_CACHE_TTL_SECONDS", "0"],
  ["PUBLIC_CACHE_TTL_SECONDS", "1.5"],
  ["PUBLIC_CACHE_TTL_SECONDS", "604801"],
  ["PUBLIC_CACHE_NAMESPACE", "bad namespace"],
]) {
  const previous = env[key];
  env[key] = value;
  assert.throws(() => settings.getPublicCacheConfig(), new RegExp(key));
  env[key] = previous;
}
const expired = [];
const paths = [];
const route = load("../src/app/api/revalidate/route.ts", {
  "node:crypto": require("node:crypto"),
  "next/cache": {
    revalidateTag: (...args) => expired.push(args),
    revalidatePath: (...args) => paths.push(args),
  },
  "@/lib/cache-config.mjs": settings,
});
const request = (token) =>
  new Request("https://site.example.test/api/revalidate", {
    method: "POST",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
assert.equal((await route.POST(request())).status, 503);
env.PUBLIC_CACHE_REVALIDATION_SECRET = "a".repeat(32);
assert.equal((await route.POST(request())).status, 401);
assert.equal((await route.POST(request("wrong"))).status, 401);
assert.equal(expired.length, 0);
const accepted = await route.POST(
  request(env.PUBLIC_CACHE_REVALIDATION_SECRET),
);
assert.equal(accepted.status, 200);
assert.equal(accepted.headers.get("cache-control"), "no-store");
assert.equal(expired[0][0], "vps-test-v1:content");
assert.equal(expired[0][1].expire, 0);
assert.equal(paths[0]?.[0], "/");
assert.equal(paths[0]?.[1], "layout");
env.PUBLIC_CACHE_ENABLED = "false";
await route.POST(request(env.PUBLIC_CACHE_REVALIDATION_SECRET));
assert.equal(expired.length, 1);
assert.equal(paths.length, 1);
// Next retains expire:0 entries in development. Our transient failures must
// remain misses there too, so the very next successful read can recover.
const wasDev = process.env.__NEXT_DEV_SERVER;
process.env.__NEXT_DEV_SERVER = "true";
try {
  const entry = (expire) => ({
    value: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("fixture result"));
        controller.close();
      },
    }),
    tags: [],
    timestamp: performance.timeOrigin + performance.now(),
    stale: 0,
    revalidate: expire === 0 ? 0 : 17,
    expire,
  });
  await nativeHandler.set("transient-failure", Promise.resolve(entry(0)));
  assert.equal(
    await nativeCache.get("transient-failure"),
    undefined,
    "development must not retain failure entries",
  );
  await nativeHandler.set("successful-fill", Promise.resolve(entry(300)));
  const hit = await nativeCache.get("successful-fill");
  assert.ok(hit, "successful cache fills must still be stored");
  assert.equal(await new Response(hit.value).text(), "fixture result");
} finally {
  if (wasDev === undefined) delete process.env.__NEXT_DEV_SERVER;
  else process.env.__NEXT_DEV_SERVER = wasDev;
}
console.log(
  "PASS: native policy, JSON boundary, live/disabled bypass, API status/error propagation, settings and authenticated immediate invalidation.",
);
