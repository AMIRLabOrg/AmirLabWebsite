import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  cp,
  symlink,
  rm,
} from "node:fs/promises";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { once } from "node:events";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const root = resolve(dirname(new URL(import.meta.url).pathname), "..");
const next = require.resolve("next/dist/bin/next");
const fixture = await mkdtemp(join(tmpdir(), "amirlab-native-cache-"));
const counts = new Map();
const contentExports = {};
vm.runInNewContext(
  require("typescript").transpileModule(
    await readFile(join(root, "src/lib/site-content.ts"), "utf8"),
    { compilerOptions: { module: require("typescript").ModuleKind.CommonJS } },
  ).outputText,
  { exports: contentExports },
);
let version = 1;
let revision = "1";
let failing = false;
let revisionFailing = false;
let releaseContent;
let contentGate;
let app;
const upstream = createServer(async (request, response) => {
  const key = request.url;
  counts.set(key, (counts.get(key) ?? 0) + 1);
  if (key === "/public-cache/revision") {
    response.writeHead(revisionFailing ? 503 : 200, {
      "content-type": "application/json",
    });
    response.end(JSON.stringify({ revision }));
    return;
  }
  if (key === "/home" || key === "/site-content/about") await contentGate;
  response.writeHead(failing ? 503 : 200, {
    "content-type": "application/json",
  });
  response.end(
    JSON.stringify(
      key === "/site-content/about"
        ? {
            content: {
              ...contentExports.DEFAULT_ABOUT_CONTENT,
              title: `About version ${version}`,
            },
          }
        : { version, path: key },
    ),
  );
});
upstream.listen(0, "127.0.0.1");
await once(upstream, "listening");
const api = `http://127.0.0.1:${upstream.address().port}`;
const secret = "fixture-only-".repeat(4);
const env = {
  ...process.env,
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_PUBLIC_API_URL: api,
  PUBLIC_CACHE_ENABLED: "true",
  PUBLIC_CACHE_TTL_SECONDS: "17",
  PUBLIC_CACHE_NAMESPACE: "fixture-v1",
  PUBLIC_CACHE_REVALIDATION_SECRET: secret,
};
async function file(path, content) {
  const target = join(fixture, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content);
}
async function run(args) {
  const child = spawn(process.execPath, [next, ...args], {
    cwd: fixture,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  const [code] = await once(child, "exit");
  assert.equal(code, 0, output);
}
async function start() {
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise((done) => socket.close(done));
  app = spawn(process.execPath, [next, "start", "-p", String(port)], {
    cwd: fixture,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  app.stdout.on("data", (data) => {
    output += data;
  });
  app.stderr.on("data", (data) => {
    output += data;
    process.stderr.write(data);
  });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (app.exitCode !== null) throw new Error(output);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(3000) });
      if (response.ok) return base;
    } catch {}
    await new Promise((done) => setTimeout(done, 200));
  }
  throw new Error(`Fixture server did not start: ${output}`);
}
async function stop() {
  const child = app;
  app = undefined;
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    const timer = setTimeout(() => child.kill("SIGKILL"), 3000);
    try {
      await once(child, "exit");
    } finally {
      clearTimeout(timer);
    }
  }
}
try {
  await symlink(join(root, "node_modules"), join(fixture, "node_modules"));
  await cp(join(root, "cache-handlers"), join(fixture, "cache-handlers"), {
    recursive: true,
  });
  await file(
    "package.json",
    JSON.stringify({
      private: true,
      dependencies: { next: "16.3.3", react: "19.2.4", "react-dom": "19.2.4" },
    }),
  );
  await file(
    "next.config.ts",
    (await readFile(join(root, "next.config.ts"), "utf8")).replace(
      "cacheComponents: true,",
      "cacheComponents: true, experimental: { cpus: 2 },",
    ),
  );
  await file(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
        strict: true,
        module: "esnext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        esModuleInterop: true,
        skipLibCheck: true,
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src/app/**/*.ts", "src/app/**/*.tsx", ".next/types/**/*.ts"],
    }),
  );
  for (const directory of ["components", "lib"]) {
    await cp(join(root, "src", directory), join(fixture, "src", directory), {
      recursive: true,
      filter: (source) => !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(source),
    });
  }
  await file(
    "src/lib/api-url.ts",
    `export const API_URL = ${JSON.stringify(api)};\n`,
  );
  for (const name of ["public-cache.ts", "cache-config.mjs"]) {
    await cp(join(root, "src/lib", name), join(fixture, "src/lib", name));
  }
  await mkdir(join(fixture, "src/app/api/revalidate"), { recursive: true });
  await cp(
    join(root, "src/app/api/revalidate/route.ts"),
    join(fixture, "src/app/api/revalidate/route.ts"),
  );
  await cp(
    join(root, "src/app/layout.tsx"),
    join(fixture, "src/app/layout.tsx"),
  );
  await file("src/app/globals.css", "");
  await mkdir(join(fixture, "src/app/(public)"), { recursive: true });
  await cp(
    join(root, "src/app/(public)/layout.tsx"),
    join(fixture, "src/app/(public)/layout.tsx"),
  );
  await file(
    "src/app/(public)/page.tsx",
    `import { Suspense } from 'react'; import { publicJson } from '@/lib/public-cache'; import { getPublicCacheConfig } from '@/lib/cache-config.mjs'; async function Content() { const value = await publicJson<{version:number}>('/home'); return <h1>Published version {value.version}</h1> } export default function Page() { const skeleton = <p>Existing loading fallback</p>; return <Suspense fallback={getPublicCacheConfig().enabled ? <Suspense fallback={skeleton}><Content /></Suspense> : skeleton}><Content /></Suspense> }\n`,
  );
  await file(
    "src/app/(public)/people/page.tsx",
    `import { publicJson } from '@/lib/public-cache'; export default async function PeoplePage() { const value = await publicJson<{version:number}>('/home'); return <h1>Published version {value.version}</h1> }\n`,
  );
  await cp(
    join(root, "src/app/(public)/people/loading.tsx"),
    join(fixture, "src/app/(public)/people/loading.tsx"),
  );
  await mkdir(join(fixture, "src/app/(public)/about"), { recursive: true });
  await cp(
    join(root, "src/app/(public)/about/page.tsx"),
    join(fixture, "src/app/(public)/about/page.tsx"),
  );
  await file(
    "src/app/read/route.ts",
    `import { publicJson } from '@/lib/public-cache'; export async function GET(request: Request) { const query = new URL(request.url).searchParams; try { return Response.json(await publicJson(query.get('path') ?? '/people', query.has('live'), query.has('stats') ? 60 : undefined)); } catch { return Response.json({error:'unavailable'}, {status:503}); } }\n`,
  );
  console.log(`Building fixture; cache enabled=${env.PUBLIC_CACHE_ENABLED}`);
  await run(["build", "--webpack"]);
  console.log("Fixture build passed");
  let base = await start();
  const read = async (path = "/people", live = false) => {
    const response = await fetch(
      `${base}/read?path=${encodeURIComponent(path)}${live ? "&live=1" : ""}`,
      { signal: AbortSignal.timeout(10000) },
    );
    return { status: response.status, data: await response.json() };
  };
  assert.equal((await read()).data.version, 1);
  const first = counts.get("/people");
  await read();
  assert.equal(counts.get("/people"), first, "warm read must avoid upstream");
  await read("/research?type=PAPER");
  await read("/research?type=DATASET");
  assert.equal(counts.get("/research?type=PAPER"), 1);
  assert.equal(counts.get("/research?type=DATASET"), 1);
  await read("/positions", true);
  version = 2;
  assert.equal((await read("/positions", true)).data.version, 2);
  assert.equal(
    (await read()).data.version,
    1,
    "entry stays cached until invalidated",
  );
  const unauthorized = await fetch(`${base}/api/revalidate`, {
    method: "POST",
  });
  assert.equal(unauthorized.status, 401);
  const invalidate = () =>
    fetch(`${base}/api/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
    });
  assert.equal((await invalidate()).status, 200);
  assert.equal((await read()).data.version, 2);
  assert.match(await (await fetch(base)).text(), /Published version <!-- -->2/);
  revision = "2";
  failing = true;
  assert.equal((await read("/cold-error")).status, 503);
  failing = false;
  assert.equal((await read("/cold-error")).data.version, 2);
  const manifest = JSON.parse(
    await readFile(join(fixture, ".next/prerender-manifest.json"), "utf8"),
  );
  assert.ok(
    manifest.routes["/"].htmlSize > 0,
    "published content must prerender",
  );
  assert.match(
    await readFile(join(fixture, ".next/server/app/index.html"), "utf8"),
    /<h1>Published version <!-- -->\d+<\/h1>/,
  );
  await stop();
  base = await start();
  assert.equal(
    (await read()).data.version,
    2,
    "restart must warm fresh runtime entries",
  );
  assert.match(
    await (await fetch(base)).text(),
    /Published version <!-- -->2/,
    "request-rendered content must stay fresh after restart",
  );
  version = 3;
  revision = "3";
  await invalidate();
  await stop();
  base = await start();
  assert.match(
    await (await fetch(base)).text(),
    /Published version <!-- -->3/,
    "save followed immediately by restart must not resurrect old shell",
  );
  version = 4;
  revision = "4";
  assert.equal(
    (await read()).data.version,
    4,
    "missed webhook must detect shared DB revision",
  );
  const fresh = await (await fetch(base)).text();
  assert.match(
    fresh,
    /Published version <!-- -->4/,
    "new request must detect other deployment's write",
  );
  const homeReads = counts.get("/home");
  const warmResponse = await fetch(base);
  assert.equal(warmResponse.headers.get("cdn-cache-control"), "no-store");
  const warmHtml = await warmResponse.text();
  assert.equal(
    counts.get("/home"),
    homeReads,
    "warm HTML must avoid content query",
  );
  const document = new JSDOM(warmHtml).window.document;
  const visibleHero = [...document.querySelectorAll("h1")].find(
    (heading) => !heading.closest("[hidden]"),
  );
  assert.equal(
    visibleHero?.textContent,
    "Published version 4",
    "cached hero must be visible without executing JavaScript",
  );
  assert.match(warmHtml, /<main[^>]*id="content"/);
  assert.match(warmHtml, /<h1>Published version <!-- -->4<\/h1>/);
  assert.ok(
    warmHtml.indexOf("Published version") <
      warmHtml.indexOf("Existing loading fallback") ||
      !warmHtml.includes("Existing loading fallback"),
    "warm public output must contain content before any fallback",
  );
  revisionFailing = true;
  version = 40;
  const unavailable = await fetch(base, { signal: AbortSignal.timeout(10000) });
  assert.equal(
    unavailable.status,
    200,
    "failed freshness checks must allow the page to render",
  );
  assert.match(
    await unavailable.text(),
    /Published version <!-- -->40/,
    "unverified cached HTML must be bypassed",
  );
  const beforeOutageRead = counts.get("/people");
  assert.equal(
    (await read()).data.version,
    40,
    "unverified cached JSON must be bypassed",
  );
  assert.ok(counts.get("/people") > beforeOutageRead);
  failing = true;
  const failedContent = await fetch(`${base}/about`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(
    failedContent.status,
    200,
    "a backend outage must not fail before React renders",
  );
  const failedHtml = await failedContent.text();
  assert.ok(
    failedHtml.includes(contentExports.DEFAULT_ABOUT_CONTENT.title),
    "the real API getter must finish in its finite fallback state",
  );
  failing = false;
  revisionFailing = false;
  version = 4;
  revision = "after-outage";
  assert.equal((await fetch(base)).status, 200, "revision check must recover");

  // Hold content pending after expiry. The actual route and component fallback
  // must stream their original visible placeholders before upstream completes.
  for (const path of ["/people", "/about"]) {
    await invalidate();
    contentGate = new Promise((resolve) => {
      releaseContent = resolve;
    });
    try {
      const response = await fetch(`${base}${path}`, {
        signal: AbortSignal.timeout(10000),
      });
      assert.equal(response.status, 200);
      const reader = response.body.getReader();
      let html = "";
      let visibleLoading = false;
      while (!visibleLoading) {
        const { value, done } = await reader.read();
        assert.equal(
          done,
          false,
          "page must stream a skeleton while content is pending",
        );
        html += new TextDecoder().decode(value);
        const document = new JSDOM(html).window.document;
        visibleLoading = [
          ...document.querySelectorAll('main [data-loading="true"]'),
        ].some((node) => !node.closest("[hidden]"));
      }
      releaseContent();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
      }
      assert.ok(
        html.includes(
          path === "/people" ? "Published version" : "About version",
        ),
        "content must replace its loading UI",
      );
    } finally {
      releaseContent();
      contentGate = undefined;
    }
  }
  await read("/ttl");
  const ttlCount = counts.get("/ttl");
  version = 5;
  await new Promise((done) => setTimeout(done, 18000));
  let refreshed;
  for (let attempt = 0; attempt < 25; attempt++) {
    refreshed = await read("/ttl");
    if (refreshed.data.version === 5) break;
    await new Promise((done) => setTimeout(done, 200));
  }
  assert.equal(refreshed.data.version, 5, "configured TTL must refresh lazily");
  assert.equal(counts.get("/ttl"), ttlCount + 1);
  await stop();
  env.PUBLIC_CACHE_ENABLED = "false";
  console.log(`Building fixture; cache enabled=${env.PUBLIC_CACHE_ENABLED}`);
  await run(["build", "--webpack"]);
  console.log("Fixture build passed");
  base = await start();
  const count = counts.get("/people") ?? 0;
  await read();
  version = 6;
  assert.equal((await read()).data.version, 6);
  assert.equal(counts.get("/people"), count + 2, "disabled reads must bypass");
  assert.match(await (await fetch(base)).text(), /Published version <!-- -->6/);
  console.log(
    "PASS: native hits, prerendered HTML, shared revision without webhook, outage cache bypass and recovery, finite API fallback, streaming skeletons on cold misses, CDN policy, TTL, restart, live/disabled reads and authenticated expiry.",
  );
} finally {
  await stop();
  await new Promise((done) => upstream.close(done));
  await rm(fixture, { recursive: true, force: true });
}
