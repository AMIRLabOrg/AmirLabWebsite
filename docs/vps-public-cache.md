# Public Cache Components

AMIRLab uses Next.js 16.3.8 native Cache Components for public data and prerendered
public output. The separate Nest API and PostgreSQL remain authoritative. All
existing skeletons, styles, animations, schema, auth and editor UX are preserved.

## Configuration

| Variable | Default | Meaning |
| --- | --- | --- |
| `PUBLIC_CACHE_ENABLED` | `true` | `false` bypasses public data caching and excludes those reads from prerendering. |
| `PUBLIC_CACHE_TTL_SECONDS` | `3600` | Safety revalidation interval, integer 1–604800 seconds. |
| `PUBLIC_CACHE_NAMESPACE` | `amirlab-public-v1` | Cache isolation/version, validated 1–100 character identifier. |

Keep build/start settings consistent; rebuild/restart when changing them. Existing
`API_URL` (embedded into the browser bundle by Next.js configuration) must point to the deployment's API. No new service or cache
credentials are needed for revision checks. Optional webhook delivery uses the
first existing `FRONTEND_ORIGINS` entry plus the fixed `/api/revalidate` path;
no separate revalidation URL is configured:

```env
# Frontend, server-only secret
PUBLIC_CACHE_REVALIDATION_SECRET=<random-secret-at-least-32-characters>
# Backend
PUBLIC_CACHE_REVALIDATION_SECRET=<the-same-secret>
```

## Data and output

`frontend/src/lib/public-cache.ts` caches successful public API JSON with
`"use cache"`, `cacheTag` and `cacheLife`. Keys include URL/path/query, namespace
and effective TTL. The underlying content fetch is no-store with a five-second
timeout, avoiding an independent fetch cache. Transient failures leave the cache
as immediately expired results (`expire: 0`) and throw outside the cached function,
so caller fallbacks can run without caching the failure or failing prerender.
Enabled public reads no longer
call `connection()`, so Next can include their results in prerendered output.
The root no longer forces all HTML to be request-rendered.

Home/about, the initial publication archive, published people/research, departments and universities use the
configured TTL. Stats use at most 60 seconds behind a request-bound Suspense section, so they do
not shorten the static homepage shell lifetime. The homepage research query is
bounded to its three displayed papers; archive queries remain unbounded.
Positions remain live because
opening/closing depends on the current time. Their home opportunities link has
its existing loading UI in a separate Suspense boundary. The opportunities page also prerenders its introduction separately from the live listings/application section. Disabled and live reads
remain request-bound. Publication search/filter changes still fetch in the browser with the existing loading UI; the initial archive and its Suspense fallback receive cached server results. The footer year is cached on the server so its clock read cannot postpone the whole public shell. Sessions, permissions and private workspace data do not
enter shared public caches.

All route/component loading fallbacks remain. Warm cached public output should
contain real content; cold regeneration, genuinely live sections and dynamic
parameters can still suspend. A cached query alone is not proof of better LCP.
Expected missing details retain 404/null handling. Other content API failures
retain finite defaults/empty/error states outside the query cache. This is not
an outage snapshot.

## Refresh freshness across deployments

Public writes update scoped revisions in the existing `SiteSetting` table and
queue durable webhook delivery in the same transaction. Scopes are `home`,
`about`, `people`, `research`, `departments`, `universities` and `positions`;
`content` remains the full-reset scope. No schema migration is required.
The legacy `cache.public.revision` value remains available for old frontends.
`GET /api/public-cache/revision` returns it alongside the scoped generations.
Deploy the backend before the frontend, and update all backend replicas before
relying on scoped invalidation. Mixed old/new backend writers require a full
cache reset after the rollout because old writers cannot advance scoped keys.

The frontend tags cached public queries and their generated shells with both
resource dependencies and the revisions observed before fetching content.
People depend on research, department and university data; research depends on
people and departments; departments depend on people, research and positions.
The webhook expires only its supplied scopes. Empty legacy webhook requests
still expire all public content. Background research jobs expire research and
people; failures that may have partially committed still invalidate their scopes.

Before reusing public entries, the handlers check the authoritative revisions.
A changed generation rejects affected stored JSON/HTML, including after a missed
webhook or a process restart. An unchanged generation no longer expires the
entire layout merely because the instance has just started. Generation tags are
also read during build, so changed build seeds can be rejected on first use.
Revision requests remain bounded and no-store; overlapping checks share only
an in-flight request. Unknown freshness bypasses cached data and uses uncached
content reads with the existing finite loading/error behavior.

The adapters reuse the installed Next native memory/file storage, serialization
and eviction; no second content cache is introduced. They import installed
`next/dist` handler implementations, so upgrading Next requires rerunning the
real integration test. Handlers remain configured in the build so Next carries them into its
server output. Revision checks also identify build-time generations. Query memory keeps Next's normal 50 MB bound.

Public routes set `CDN-Cache-Control: no-store`: an independent HTML CDN must not
bypass the freshness check. Next's server output cache remains enabled. A custom
reverse proxy must honor this policy; do not add independent public HTML caching.
Vercel integration and its treatment of custom handlers/CDN headers require a
preview verification before claiming hosted freshness. Node integration is
tested separately; hosted deployment is not implied by a local pass.

The revision request uses Node HTTP(S), not Next's instrumented application
fetch, to avoid recursive cache lookups. It has a three-second timeout and a
bounded 4 KB JSON body. Revision failures bypass cached HTML and JSON instead
of certifying stored output as fresh or throwing before React can render.
The normal content request still has its five-second timeout and finishes in
the existing finite fallback state on failure. No permanent loading state is
introduced. Each revision lookup has a three-second timeout and can delay the
initial response; stale cached content is not served during that check.

Existing authenticated webhooks still expire the tag and root layout output immediately, with durable
backend retry/backoff. Single and bulk project-change approvals also invalidate
published project data. Revision/write or delivery failures are logged and queued;
an already committed editor save is not turned into a failure. Freshness during
a failed revision write is therefore not guaranteed until retry succeeds.
Already-open tabs are not pushed updates. A hard refresh/new server request
checks freshness; Next's browser Router Cache is separate. Direct SQL/seed/CLI
maintenance bypasses the application invalidation pipeline and needs an explicit
revision update or application invalidation after authorized maintenance.

## Deployment

Deploy **both backends first**, verify `/api/public-cache/revision` returns JSON
and no-store, then deploy frontends. Older backends lacking this endpoint cannot
satisfy this freshness contract. No hosted settings or data were changed here.

On the VPS install the updated `backend/deploy/amirl-web.service` and reload
systemd: its obsolete `prepare-public-cache.mjs` pre-start line was removed.
Native output caches can use the normal writable `.next` directory. Never mount
an empty directory over the complete build. No separate disk-backed invalidation
store or provider SDK is required; the database revision survives restart.

## Verification

```bash
node frontend/scripts/test-public-cache.mjs
node frontend/scripts/test-native-public-cache.mjs
VITEST_MAX_WORKERS=2 pnpm --dir frontend run verify:production
# Backend uses compatible Node 24.9+ and Nest/Jest ESM support:
NODE_OPTIONS=--experimental-vm-modules pnpm --dir backend run verify:production
```

The isolated Next fixture uses the actual root shell/providers and tests real native hits, argument isolation, live and
disabled reads, authenticated invalidation, prerendered content, missed webhook
freshness, restart immediately after an edit, API error recovery and lazy TTL.
It does not write hosted content. Earlier warm-query TTFB numbers described the
superseded request-rendered implementation and are not results for this revision.
The real-shell integration passed warm hits, missed webhooks, immediate restart, revision outage/recovery, CDN policy, TTL, and disabled/live reads. Generated public HTML was checked for actual main/headings, rather than merely serialized React data. Publication tests cover server fallback content, no initial browser request, refreshed server props, and pending filter requests/clear URL behavior.

A full frontend test run under heavy concurrent workstation load passed 39/43, with four existing five-second timeouts; the affected two files passed all 7 tests serially using a CLI-only 30-second timeout. Repository test limits and assertions were not changed. Hosted browser/editor checks and new performance measurements are still pending deployment.

## Public rendering and loading states

Public, auth and workspace routes now use separate server layouts under one
root document. Route groups preserve all URLs; auth/workspace retain their
existing wrappers. The pathname-dependent header has a local boundary with the
same complete header as its fallback. The footer's clock is cached on the server.

A broad shell boundary was not the only cause of the loading flash. The actual
production HTML also retained full-page placeholders as Suspense fallbacks,
even with warm data. Enabled-cache fallbacks can reuse each normal page and its
cached published data, inside a nested Suspense boundary with the original
loading view as its synchronous fallback. A cold or invalidated query therefore
renders the same skeleton without waiting for the page's data. Cache-disabled
reads use the original loading view directly; live positions and browser filter
requests retain their loading states.
The positions introduction stays visible while its live section loads. CSS,
frame patterns, animations and schema are unchanged.

After a production build, run:

```bash
node frontend/scripts/test-public-prerender.mjs
```

This checks actual generated HTML without executing scripts, rejecting headings
that only occur in hidden React streaming containers. All eight public index
pages passed; cached listing sections contain no visible loading placeholders.
The native integration fixture also includes an automatic route-loading boundary
and checks warm heading visibility, native query reuse, revision freshness,
cache bypass during revision outages, finite content-error recovery, and visible
streamed skeletons before a held-upstream response completes. The loading
regression tests exercise all six affected fallback paths with pending queries;
backend regression tests cover single and bulk project-approval invalidation.
Read-only local production HTTP checks passed all eight index routes. Warm
About, People, Departments, Papers, Datasets and Projects responses returned
`x-nextjs-cache: HIT`. Home and Open positions retain live sections and did not
return that whole-route header; the native fixture separately proves content
query reuse. Browser navigation verified Home, People and the transition from
loading to populated live positions, with the frame patterns intact.

All 52 page URLs were retained. Full frontend lint/architecture/safety checks and
the production build passed after layout separation. The full UI suite passed
42/43 under concurrent workstation build load; the single editor timing failure
passed all three cases when rerun alone. These results do not replace hosted
preview, editor-save, or Lighthouse verification. Deploy the backend revision
endpoint before the frontend. A temporary local revision responder used for
read-only visual checks is a test fixture, not production invalidation evidence.

## Loading and outage repair verification (2026-10-11)

The six pending-query loading regressions and single/bulk project approval
regressions failed before their repairs and pass afterwards. The frontend suite
passes 49 tests; the backend suite passes 228 tests and its complete production
verification, including its build. Cache policy checks also verify that transient
failures are not retained in development and successful fills remain cached.
The isolated Next production fixture passes warm HTML visibility, native reuse,
invalidation/restart, revision outage bypass, finite API fallback, and actual
streaming placeholders before held content completes, with caching both enabled
and disabled. A fresh independent review found no remaining repair defects.

The complete frontend compiles and passes TypeScript with Webpack, but the
current local `.env.local` API URL is rejected by the existing production URL
guard during page collection. No local development URL or production guard was
changed to bypass that check. Turbopack also encounters a worker port-permission
error in this environment. Hosted deployment and browser/editor verification
remain separate from these fixture results.

## ISR write reduction verification (2026-10-19)

Run `node frontend/scripts/test-homepage-cache.mjs` from the repository root.
It builds an isolated copy of the real homepage with a synthetic 1,200-paper API
and compares the previous unbounded/minute-statistics data flow against the
repair with identical UI. The fixture verifies the generated revalidation
interval, cached HTML plus metadata size, bounded API query, and generation
checks against actual filesystem cache entries. It uses Next's TypeScript API
and worker threads inside the fixture so it can build without spawning child
processes or opening localhost ports; application deployment settings are unchanged.

The first measured build changed the shell interval from 60 to 3,600 seconds
and HTML plus metadata from 1,200,803 to 126,873 bytes (89.4% smaller). These
are synthetic fixture results, not measured Vercel usage savings. The existing
`test-native-public-cache.mjs` HTTP/streaming/restart fixture requires localhost
listening permission. Hosted verification still needs before/after ISR writes,
entry sizes, editor-save freshness and loading/outage browser checks.
