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

Backend:

```bash
cd backend
pnpm install
pnpm run db:rebuild
pnpm run start:dev
```

Frontend, in another terminal:

```bash
cd frontend
pnpm install
pnpm run dev
```

Open `http://localhost:3000`. The API runs at `http://localhost:3001/api`.

Configure local values in `backend/.env`.

## Verify

After dependencies are installed:

```bash
pnpm run verify:production
```

Engineering and repository rules are in [`RULES.md`](RULES.md).
