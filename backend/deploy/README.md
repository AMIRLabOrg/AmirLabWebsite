# VPS deployment files

These templates run the built NestJS API and Next.js frontend behind Caddy.
They assume the repository is installed at `/opt/amirl` and both processes run
as the `amirl` system user.

Before enabling the services:

1. Install dependencies and build both applications with
   `NEXT_PUBLIC_API_URL=https://api.amirl.org/api` available to the frontend
   build.
2. Put backend secrets in `/etc/amirl/api.env`. Production requires
   `NODE_ENV=production`, `DATABASE_URL`, `FRONTEND_ORIGINS`, complete SMTP
   credentials, and `UPLOAD_ROOT=/var/lib/amirl/uploads`.
3. Create `/var/lib/amirl/uploads` owned by `amirl:amirl` with mode `0750`.
4. Apply the database schema with `pnpm run db:push`. Use `pnpm run db:seed`
   only for an empty first-time database; never use `db:rebuild` in production.
5. Install `amirl-api.service` and `amirl-web.service` under
   `/etc/systemd/system`, then install the `Caddyfile`.

After starting the services, verify both
`https://api.amirl.org/api/health` and `https://amirl.org` before considering
the release live.
