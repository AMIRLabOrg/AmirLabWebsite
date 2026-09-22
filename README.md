# AMIRLab

AMIRLab is a full-stack research-lab platform with a public website and a private workspace for people, publications, datasets, projects, applications, reviews, weekly reports, and lab administration.

## Stack

- Next.js 16 + React 19
- NestJS 11
- Prisma + PostgreSQL
- Tailwind CSS
- Nodemailer / SMTP

## Run locally

Requirements: Node.js 22+, pnpm 10+, and PostgreSQL binaries (`initdb`, `pg_ctl`, `psql`, `createdb`).

Install the frontend and backend dependencies from the repository root:

```bash
pnpm install
```

Configure local values in `backend/.env`, prepare the database, and start both applications. The root command starts the API first, waits for its health endpoint, and only then starts Next.js:

```bash
pnpm run db:rebuild
pnpm run dev
```

Open `http://localhost:3000`. The API runs at `http://localhost:3001/api`.

The applications can also be started separately:

```bash
pnpm run dev:backend
pnpm run dev:frontend
```

## Deploy to a VPS

For Hostinger VPS deployment on Ubuntu, follow the production runbook in
[`backend/deploy/README.md`](backend/deploy/README.md). It covers PostgreSQL,
DNS, Caddy HTTPS, systemd services, production environment variables, uploads,
updates, and backups.

## Deploy to Fly.io

Fly uses separate apps so the API and web process do not compete for startup or
network resources. Deploy the API first; its release command applies the Prisma
schema before the API machine becomes healthy. Then deploy the web app. Both
apps use the domains and credentials supplied through the environment.

```bash
fly apps create "$FLY_API_APP"
fly apps create "$FLY_WEB_APP"
fly volumes create amirlab_uploads --app "$FLY_API_APP" --region "$FLY_REGION" --size 10
fly secrets set --app "$FLY_API_APP" \
  DATABASE_URL="$DATABASE_URL" FRONTEND_ORIGINS="$FRONTEND_ORIGINS" \
  SMTP_HOST="$SMTP_HOST" SMTP_PORT="$SMTP_PORT" \
  SMTP_USER="$SMTP_USER" SMTP_PASSWORD="$SMTP_PASSWORD" \
  SMTP_FROM="$SMTP_FROM" SMTP_SECURE="$SMTP_SECURE" \
  SMTP_REQUIRE_TLS="$SMTP_REQUIRE_TLS" \
  ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_NAME="$ADMIN_NAME" \
  ADMIN_PASSWORD="$ADMIN_PASSWORD"
fly deploy --config fly.api.toml --app "$FLY_API_APP"
fly deploy --config fly.web.toml --app "$FLY_WEB_APP" \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL"
```

The API entrypoint applies the schema, seeds an empty database from the
supplied `ADMIN_*` and SMTP environment values, and then starts the API. It
skips seeding once users exist. Do not put credentials in `fly.toml`, an env
file committed to the repository, or a Docker build argument. The API volume
is required because seeded and uploaded documents are stored under
`UPLOAD_ROOT`.

## Workspace

- `frontend` — Next.js public site and private workspace
- `backend` — NestJS API, Prisma schema, and PostgreSQL tooling
- `verification` — contracts that span both applications

The repository uses a pnpm workspace with one root lockfile. Add dependencies to the package that uses them:

```bash
pnpm --filter web add <package>
pnpm --filter api add <package>
```

## Verify

Run checks from the repository root:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run verify
pnpm run verify:production
```

Engineering and repository rules are in [`RULES.md`](RULES.md).
