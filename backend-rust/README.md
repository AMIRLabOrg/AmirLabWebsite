# AMIRLab Rust backend (incremental migration)

This is a **parallel scaffold**, not a drop-in replacement for the NestJS API. Production remains on `backend/`. Do not point this service at production until endpoint parity, authorization, and operational checks pass.

## Observed NestJS contracts

- Global API prefix: `/api`; root `/` returns a JSON 404.
- `GET /api/health` queries PostgreSQL (`SELECT 1`) and returns `{ "status": "ok", "timestamp": "<ISO-8601>" }`.
- Global validation: transform + whitelist + forbid non-whitelisted input.
- Error JSON: `{ "statusCode": number, "code": string, "message": string, "issues"?: [...] }`.
- Session-cookie auth and role guards are global; only explicitly `@Public()` routes are anonymous.
- CORS allows configured origins plus an existing restricted Vercel preview-host policy. The Rust scaffold currently allows **configured origins only**; preview parity remains TODO.
- Existing PostgreSQL schema is owned by `backend/prisma/schema.prisma` and migrations. **Do not auto-sync or modify schema from Rust.**
- Existing backend also uses Redis, storage, SMTP, Socket.IO, web push, and scheduled jobs. Those are not migrated.

## Run

Requires Rust stable and a disposable PostgreSQL database:

```sh
cd backend-rust
cp .env.example .env
# Set DATABASE_URL and FRONTEND_ORIGINS in your environment.
set -a; . ./.env; set +a
cargo fmt --check
cargo check
cargo test
cargo run
curl -i http://localhost:3001/api/health
```

Do not source an untrusted .env file. The application reads environment variables; it does not automatically load .env.

## Agent migration protocol

1. Select **one** NestJS feature/endpoint. Inspect its controller, DTO, service, guards, Prisma queries, and all frontend consumers. Inventory methods, route paths, status codes, query/body validation, JSON casing, pagination, error responses, permissions, side effects, and caching.
2. Write parity tests against the existing NestJS API using a disposable fixture database; record representative successful, empty, invalid, unauthorized, forbidden, and missing-resource cases. Never snapshot secrets or personal data.
3. Implement the same contract in `src/routes/<feature>/` with explicit handler/service/repository separation only when useful. Reuse `AppState`, shared error conventions, and SeaORM; use parameterized SQL for complex queries.
4. Keep auth **deny-by-default**. Do not expose protected endpoints until session-cookie verification, revocation, role checks, and CSRF-relevant behavior have parity tests. No placeholder auth or permissive fallback.
5. Compare Rust and NestJS responses, including headers and status codes. Run `cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` and existing frontend/backend tests.
6. Review changes for SQL injection, authorization, transactions, error leakage, connection pressure, query count, timeouts, and feature regressions. Fix and re-review before committing.
7. Commit one feature per iteration. Do not modify or remove NestJS routes yet. Use an isolated port/hostname and progressively route traffic only after proven parity.

## Suggested order

1. Health and error contract tests.
2. Read-only public routes: stats, people, departments, publications, projects, datasets.
3. Public caching, search/pagination, and response-shape parity.
4. Auth/session and RBAC (security-critical).
5. Mutations, review workflows, uploads, documents, integrations, background jobs, notifications and realtime features.

## Performance and operations

The current NestJS service has a global throttle of 100 requests per 60 seconds (per client identity under its guard configuration); investigate rate limiting and real failure codes before attributing k6 failures to runtime performance. This Rust scaffold does not yet implement equivalent throttling. The pool currently caps at 5 PostgreSQL connections to suit a small VPS; tune from actual Supabase and API metrics. Avoid database schema changes during migration.

## Known scaffold limitations

The `/api/publications` vertical slice now has a controller, validated query DTO, service, and parameterized PostgreSQL repository. It implements filters, sorting, pagination, contributor names and global facets. **It is not yet proven response-compatible**: the Prisma `RESEARCH_INCLUDE` graph contains nested relationships (notably project/dataset structures) that require explicit parity verification, and production data/HTTP contract tests have not been run. Do not switch this route to Rust until contract tests pass. Other than that slice, only `/api/health` and JSON 404 are implemented. CORS preview-host behavior, authentication, throttling, compression, shutdown policy, readiness/liveness split, all feature routes, and API docs are pending. Do not switch production traffic to this scaffold.

## Publications migration checkpoint

Compare NestJS and Rust for `GET /api/publications` with defaults, empty results, case-insensitive search, literal `%` and `_`, category/year, all three sort orders, pagination boundaries, contributor/person joins, facets, nulls, timestamps and validation errors. Verify actual Prisma serialization for every returned field. The SQL is an initial implementation, **not a verified parity migration**. Cargo was not available in the authoring environment; CI must compile and test before this checkpoint is accepted.
