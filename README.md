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

Configure local values in `backend/.env`, prepare the database, and start both applications:

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
