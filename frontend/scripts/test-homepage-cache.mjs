import assert from "node:assert/strict";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";

const require = createRequire(import.meta.url);
const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const fixture = await mkdtemp(join(tmpdir(), "amirlab-home-cache-"));
async function file(path, content) {
  await mkdir(dirname(join(fixture, path)), { recursive: true });
  await writeFile(join(fixture, path), content);
}
try {
  await symlink(join(root, "node_modules"), join(fixture, "node_modules"));
  for (const path of ["src/components", "src/lib", "cache-handlers"]) {
    await cp(join(root, path), join(fixture, path), {
      recursive: true,
      filter: (source) => !/\.(?:test|spec)\.[jt]sx?$/.test(source),
    });
  }
  for (const path of [
    "package.json",
    "tsconfig.json",
    "src/app/layout.tsx",
    "src/app/(public)/layout.tsx",
    "src/app/(public)/page.tsx",
  ]) {
    await mkdir(dirname(join(fixture, path)), { recursive: true });
    await cp(join(root, path), join(fixture, path));
  }
  await file("src/app/globals.css", "");
  await file(
    "next.config.ts",
    (await readFile(join(root, "next.config.ts"), "utf8")).replace(
      "cacheComponents: true,",
      "cacheComponents: true, experimental: { cpus: 2, workerThreads: true, webpackBuildWorker: false, useTypeScriptCli: false },",
    ),
  );
  // Compare the real homepage against the previous data flow using identical UI.
  await file(
    "src/app/(public)/unbounded/page.tsx",
    `
import { Suspense } from 'react';
import { HomePageView, HomeOpportunitiesLink } from '@/components/home-page-view';
import { getHomeContent, getResearch, getUniversities, getPositions } from '@/lib/api';
import { publicJson } from '@/lib/public-cache';
import type { PublicStats } from '@/lib/types';
async function Live() { return <HomeOpportunitiesLink positions={await getPositions()} />; }
export default async function Page() {
  const [content, research, stats, universities] = await Promise.all([
    getHomeContent(), getResearch('PAPER'), publicJson<PublicStats>('/stats', false, 60), getUniversities(),
  ]);
  return <HomePageView content={content} research={research} stats={stats} universities={universities}
    opportunities={<Suspense fallback={<HomeOpportunitiesLink loading />}><Live /></Suspense>} />;
}
`,
  );
  // Mock only the API transport: Next still performs its actual production
  // prerender, cache serialization and manifest generation without opening ports.
  await file(
    "upstream.mjs",
    `
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { appendFileSync } from 'node:fs';
const papers = Array.from({length: 1200}, (_, index) => ({
  id: String(index), type: 'PAPER', title: 'Published paper ' + index,
  summary: Array.from({length: 8}, (_, part) => createHash('sha512').update(index + ':' + part).digest('hex')).join(''),
  paper: { year: 2026, citation: 'Author. Published paper ' + index }, contributors: [],
}));
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (url.hostname !== 'cache-fixture.test') return originalFetch(input, options);
  appendFileSync(new URL('./reads.log', import.meta.url), url.pathname + url.search + '\\n');
  let value;
  switch(url.pathname) {
    case '/api/research': value = url.searchParams.has('limit') ? papers.slice(0, Number(url.searchParams.get('limit'))) : papers; break;
    case '/api/stats': value = {papers:1200, people:36, datasets:0, projects:0, openPositions:0}; break;
    case '/api/site-content/home': value = {content:{heroTitle:'Fixture homepage',heroIntroduction:'Published content'}}; break;
    default: value = [];
  }
  return Response.json(value);
};
const originalGet = http.get;
export const upstreamState = {revision:'initial',scopes:{content:'initial'}};
function get(input, options, callback) {
  if (new URL(input).hostname !== 'cache-fixture.test') return originalGet(input, options, callback);
  const request = Object.assign(new EventEmitter(), { destroy(error) { request.emit('error', error); } });
  queueMicrotask(() => {
    const response = Object.assign(new EventEmitter(), { statusCode:200, setEncoding(){}, resume(){} });
    callback(response);
    response.emit('data', JSON.stringify(upstreamState));
    response.emit('end');
  });
  return request;
}
http.get = get; https.get = get; syncBuiltinESMExports();
`,
  );
  Object.assign(process.env, {
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    API_URL: "https://cache-fixture.test/api",
    PUBLIC_CACHE_ENABLED: "true",
    PUBLIC_CACHE_TTL_SECONDS: "3600",
    PUBLIC_CACHE_NAMESPACE: "homepage-fixture",
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${pathToFileURL(join(fixture, "upstream.mjs"))}`,
  });
  process.execArgv.push(
    `--import=${pathToFileURL(join(fixture, "upstream.mjs"))}`,
  );
  const { upstreamState } = await import(
    pathToFileURL(join(fixture, "upstream.mjs")).href
  );
  process.chdir(fixture);
  const { Bundler } = require("next/dist/lib/bundler");
  await require("next/dist/build").default(
    fixture,
    false,
    false,
    false,
    false,
    false,
    false,
    Bundler.Webpack,
    "default",
  );
  const manifest = JSON.parse(
    await readFile(join(fixture, ".next/prerender-manifest.json"), "utf8"),
  );
  assert.equal(
    manifest.routes["/"].initialRevalidateSeconds,
    3600,
    "live stats must not shorten the homepage shell lifetime",
  );
  assert.equal(manifest.routes["/unbounded"].initialRevalidateSeconds, 60);
  async function bytes(name) {
    return (
      (await readFile(join(fixture, `.next/server/app/${name}.html`))).length +
      (await readFile(join(fixture, `.next/server/app/${name}.meta`))).length
    );
  }
  const before = await bytes("unbounded");
  const after = await bytes("index");
  assert.ok(
    after < before / 2,
    `bounded homepage must reduce cached bytes: ${before} -> ${after}`,
  );
  const reads = await readFile(join(fixture, "reads.log"), "utf8");
  assert.ok(reads.includes("/api/research?type=PAPER&limit=3"));
  assert.match(
    await readFile(join(fixture, ".next/server/app/index.html"), "utf8"),
    /Fixture homepage/,
  );
  const { default: RouteCache } = await import(
    pathToFileURL(join(fixture, "cache-handlers/route.mjs")).href
  );
  const routes = new RouteCache({
    fs: { readFile, stat, existsSync },
    flushToDisk: false,
    serverDistDir: join(fixture, ".next/server"),
    revalidatedTags: [],
  });
  const context = { kind: "APP_PAGE", isRoutePPREnabled: true };
  const entry = await routes.get("/index", context);
  assert.ok(entry, "cold process must retain an unchanged build shell");
  const tags = entry.value.headers["x-next-cache-tags"].split(",");
  assert.ok(tags.includes("homepage-fixture:revision:home:initial"));
  upstreamState.scopes.about = "about-edit";
  assert.ok(
    await routes.get("/index", context),
    "unrelated editorial edits must retain the homepage shell",
  );
  upstreamState.scopes.home = "home-edit";
  assert.equal(
    await routes.get("/index", context),
    null,
    "a missed homepage webhook must reject the old shell",
  );
  const restarted = await import(
    `${pathToFileURL(join(fixture, "cache-handlers/revision.mjs"))}?restart`
  );
  await restarted.refreshRevision();
  assert.equal(
    restarted.tagsCurrent(tags),
    false,
    "a cold process must also reject changed build generations",
  );
  console.log(
    `PASS: real Next production build; unchanged cold-start shell reused, scoped missed webhook rejected, unrelated content retained; homepage lifetime 60 -> 3600 seconds; cached HTML + metadata ${before} -> ${after} bytes (${(100 * (1 - after / before)).toFixed(1)}% smaller in the 1200-paper fixture).`,
  );
} finally {
  process.chdir(root);
  await rm(fixture, { recursive: true, force: true });
}
