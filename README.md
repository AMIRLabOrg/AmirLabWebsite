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

Install each application independently from the repository root:

```bash
pnpm --dir backend install
pnpm --dir frontend install
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

## Database commands

Run the commands below from the repository root with `pnpm run <command>`.
Every command uses `DATABASE_URL` from the environment or `backend/.env`, and
behaves the same whether it points at a local PostgreSQL server or a hosted one
such as Supabase. Creating the administrator requires `ADMIN_EMAIL`,
`ADMIN_NAME`, and `ADMIN_PASSWORD` (at least 12 characters, with no placeholder
value).

| Command | Behavior |
| --- | --- |
| `db:generate` | Generates the Prisma client and types from `backend/prisma/schema.prisma`. Does not modify the database. Installation and backend builds also generate the client automatically. |
| `db:push` | Applies the schema to the database: runs the legacy profile-entry, single-email, and system-account migrations, then `prisma db push`, and regenerates the client. Does not seed records, delete data, or reset the schema; Prisma can reject a change that would lose data. |
| `db:seed` | Runs `db:push`, then additively inserts any seed records that are missing. Never deletes or overwrites existing data, so it is safe to re-run against a populated database. New imported profiles, papers, and projects await review; positions start as drafts. |
| `db:rebuild` | **Force-resets the application database schema, deletes all of its data**, regenerates the client, seeds it, then verifies the import. Works against any host, but prompts for confirmation first; pass `-- --yes` (or `DB_REBUILD_CONFIRM=yes`) to skip the prompt. Use only when existing data can be discarded. |
| `db:verify` | Checks the expected fresh seed state, including record counts, review statuses, contributor provenance, site settings, and avatar files. This is a seed verification command, not a general health check: later edits or approvals can make it fail. |
| `seed:validate` | Validates `backend/seed/amirl-site.json` and checks referenced avatar and university-logo source files. Prints dataset counts without connecting to PostgreSQL. |

Expect a PostgreSQL server to already be running at `DATABASE_URL`; the Docker
Compose service (`docker compose up -d postgres`) and any system PostgreSQL both
work.

For first-time setup or an intentional fresh start:

```bash
pnpm run seed:validate
pnpm run db:rebuild
```

For normal development with existing data:

```bash
pnpm run dev
```

After changing the Prisma schema, run `pnpm run db:push` to apply it, or
`pnpm run db:seed` to apply it and insert any new seed records. Run
`pnpm run db:generate` if you only need to refresh the generated client.


## Backup and recovery

The admin **Settings → Backup & restore** panel saves a local backup directory,
interval in minutes, and schedule toggle without a redeploy. It also creates
manual backups and restores a selected backup after typing `RESTORE`. The API
must be running for scheduled backups; it checks the schedule every minute.

Backups support **local or remote PostgreSQL with local uploads**, including
production. S3-hosted upload sources are not yet supported; selecting S3 as a
backup destination does not change that. Destinations support local directories,
S3-compatible storage and SFTP; remote delivery and restore still need a live
test with actual credentials. Use a direct PostgreSQL connection with the required
dump/restore permissions; transaction-pooler endpoints may not support these tools.
TLS mode, CA/client certificates, certificate revocation lists, channel binding,
connection timeout and server options are forwarded from DATABASE_URL to the tools.

Archives contain a PostgreSQL custom-format dump, uploads, and SHA-256 file
checksums. The list checks archive integrity before offering restore; an
integrity check does not prove recovery. Backups are kept until you remove them
manually. Database dumping and file copying are separate operations: pause
database/upload writes when a coordinated database-and-files recovery point is
required. The schedule does not pause application writes. Run scheduling on one
API instance; the existing operation lock is per process.
`pg_dump` and `pg_restore` must be installed and compatible with your server.
The API Docker image includes PostgreSQL 18 clients and OpenSSH SFTP; set the
`POSTGRES_MAJOR` build argument if another client version is required. A VPS
installation running outside Docker must install these tools separately.

Safety snapshots are labeled separately and excluded from the default regular backup selection.
A restore replaces database records and uploads and creates a safety backup first.
Production restore is disabled in the live API and panel. Stop **all API instances,
background workers and other database/upload writers**, then run the recovery
command below from the deployed backend directory with access to the upload
volume. The required `--services-stopped` flag acknowledges this operator action;
it does not stop processes for you. After recovery, clear persistent public caches
and restart the services. Preserve the encryption key outside the database and
backup archive so saved remote credentials remain usable. If the process
is interrupted, the API refuses to start while `<upload-directory>.restore-pending.json`
exists. That file names the safety backup and backup directory. Complete recovery
with the command below before restarting; do not simply delete the marker.

If the database is cleared, its accounts and settings disappear too. Recover
without signing in using an explicit target URL, backup directory, backup ID,
and upload directory. This command **never loads `.env`**:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5433/DATABASE \
  pnpm --dir backend backup:restore \
  /absolute/backup/directory BACKUP_UUID /absolute/upload/directory \
  --replace-data --services-stopped
```

The archive must name the same database as the target URL. To run the destructive
verification script, first initialize a dedicated local database named
`amirl_backup_verification` with `prisma db push`, then run:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:5433/amirl_backup_verification \
  pnpm --dir backend exec tsx scripts/verify-local-backups.ts
```

The script refuses other database names and hosts, captures real backups, tests
the schedule and corruption handling, clears that database's schema, proves an
application query fails, restores through the recovery command, and compares
records and upload bytes. Test archives and the verification report remain in
its printed temporary directory. It does not clear the normal development or
hosted databases.

## Deploy to a VPS

For Hostinger VPS deployment on Ubuntu, follow the production runbook in
[`backend/deploy/README.md`](backend/deploy/README.md). It covers PostgreSQL,
DNS, Caddy HTTPS, systemd services, production environment variables, uploads,
updates, and backups.

## Deploy to Fly.io

Fly deploys the API only. The Fly app uses `backend/` as its working directory,
where `fly.toml` and `Dockerfile` live. Keep `DATABASE_URL` as a Fly secret; it
points to the externally hosted PostgreSQL database. Enable Fly auto-deploys
from `main` in the app settings, or deploy manually from the repository root:

```bash
fly deploy ./backend --app "$FLY_API_APP"
```

The Fly release command applies the Prisma schema and seeds an empty database
from the supplied `ADMIN_*` and SMTP environment values. The machine entrypoint
starts the API after release succeeds. Do not create a Fly Postgres app. Deploy
the frontend separately to Vercel with Root Directory `frontend` and
`API_URL=https://<your-fly-app>.fly.dev/api`. Set `DATABASE_URL`, `FRONTEND_ORIGINS`,
`PUBLIC_SITE_EMAIL`, the `SMTP_*` values, and `ADMIN_EMAIL`,
`ADMIN_NAME`, and `ADMIN_PASSWORD` as Fly secrets; add `STORAGE_*` secrets when
using object storage. Do not put credentials in `fly.toml`, an env file
committed to the repository, or a Docker build argument. The API volume is
required because seeded and uploaded documents are stored under `UPLOAD_ROOT`.
On Fly, use the mounted path from `fly.toml`; remove any `UPLOAD_ROOT` secret
that overrides it with a local development path such as `./storage`.

Public images use `/api/assets/<id>` on the frontend. Next.js forwards that path
to the backend configured by `API_URL`, so the same image URLs and optimization
work in local development, on Vercel, and on a VPS. Rebuild the frontend after
changing `API_URL`.

## Browser push notifications

Generate the VAPID configuration in the gitignored `backend/.env`:

```bash
pnpm --dir backend run push:configure
```

The command reuses existing keys and does not print them. Keep
`VAPID_PRIVATE_KEY` backend-only. Configure `VAPID_PUBLIC_KEY`,
`VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` in the hosted API's secret store as
well, then restart the API. Reuse the same keys across restarts and deployments
so existing browser subscriptions remain valid.

In **Workspace → Settings → Account & devices → Browser notifications**, select
**Enable notifications**, allow browser permission, and select **Send test**.
Enable separately on each device. Hosted push requires HTTPS; on iPhone or iPad,
add AmirLab to the Home Screen and open the installed app first.

## Workspace

- `frontend` — Next.js public site and private workspace
- `backend` — NestJS API, Prisma schema, and PostgreSQL tooling
- `verification` — contracts that span both applications

Backend and frontend are independent pnpm projects with separate lockfiles and install directories. Add dependencies from the owning project:

```bash
pnpm --dir frontend add <package>
pnpm --dir backend add <package>
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

### Backup destination presets

The admin backup panel offers **Same server / local directory**, **S3-compatible storage**, and **SFTP server**. Changing a preset changes its fields and disables the schedule until you save it. Settings are stored in the database and take effect without a redeploy. Sources support local or remote PostgreSQL and local uploads, including production. S3-hosted upload sources remain unsupported. Production restoration uses the offline recovery command rather than the running API.

For S3, supply bucket, region, access key ID and secret access key. Leave the endpoint empty for AWS, or supply an HTTPS endpoint and the path-style setting required by your S3-compatible service. A prefix is optional. The account needs bucket listing and object read/write permissions for that prefix. For SFTP, supply host, port, username, an absolute remote directory and a **verified SSH public host key** from the server administrator. Authentication accepts a dedicated unencrypted private key or a password. OpenSSH `sftp` must be installed. Host-key verification remains strict; plain FTP is unsupported. See the [OpenSSH SFTP manual](https://man.openbsd.org/sftp.1) for transport requirements.

Saved remote credentials are encrypted with AES-256-GCM using the backend-only `ENCRYPTION_KEY` environment secret. Generate a stable 32-byte key with `openssl rand -base64 32`; every API instance that reads these settings must use the same value. Existing upload-directory keys remain as a read-only fallback for previously encrypted credentials. Status responses never return credentials. Blank credential inputs preserve saved values only for the same provider and authentication method. Use a manual backup before enabling a remote schedule.

Remote listings show **Integrity unchecked** because listing downloads manifests rather than complete archives. Restore downloads and checks every declared file and PostgreSQL archive before replacing local data. A manifest is published last; incomplete transfers are not recovery points. Failed transfers may leave unindexed files at the destination, which the operator can remove. Backup retention and remote lifecycle deletion are not automatic.

When local database settings/authentication tables are missing, remote recovery accepts an operator-owned private configuration file (mode 0600):

```sh
DATABASE_URL='postgresql://user:password@127.0.0.1:5433/local_test' \
  pnpm --dir backend backup:restore --storage-config /private/storage.json \
  <backup-id> /absolute/uploads --replace-data --services-stopped
```

The JSON uses the admin settings names, plus credentials. For example an S3 file contains `provider`, `bucket`, `region`, optional `endpoint`, `prefix`, `forcePathStyle`, `accessKeyId`, `secretAccessKey`, `enabled: false`, and `intervalMinutes: 60`. An SFTP file contains `provider`, `host`, `port`, `username`, `remoteDirectory`, `hostKey`, `authentication`, the matching `privateKey` or `password`, and the same schedule fields. Never commit this file. Stop the API and other writers before recovery. The local-directory form uses the same command. The CLI never loads `.env`; production and remote database recovery require an explicit DATABASE_URL and acknowledgement that all services are stopped.

Provider contract tests cover streaming, pagination, publication order, path validation, SSH command quoting and credential cleanup. Live S3 and SFTP delivery/restore require actual credentials and an endpoint and must be verified before relying on them.

### OpenAlex publications

Use **My profile → Research sync → OpenAlex** and enter the author's ID (for example, `A5106152722`). Administrators use the existing member profile editor. The ID follows the normal profile save/approval policy and is stored as an OpenAlex profile link; eligible imports do not need paper-by-paper approval.

The real-person seed includes 58 verified OpenAlex author IDs; 56 profiles remain unassigned because no reliable match was established. Matching evidence and unresolved candidates are recorded in `backend/seed/openalex-author-matches.json`. Seeded profiles still await normal profile review before their OpenAlex sync starts.

Setting, changing or removing this link replaces that person's previous paper and dataset associations immediately when the profile change is applied. Unshared old outputs are deleted; outputs still associated with another person remain. Changing the link queues the new author's data. Removing it pauses sync. Internal projects and unrelated profile information remain intact. Each author ID can be linked to one local person; invalid or duplicate links are rejected.

The server uses the existing jobs worker, with a due check every hour and a successful sync interval of 24 hours. Keep the backend running for scheduled sync. Administrators can set, replace or remove the API key under **Settings → Verification → OpenAlex** without restarting or deploying. New keys are checked with OpenAlex before saving; rejected keys or failed validation requests leave the previous setting intact. Keys are encrypted in the database and never returned to the browser or included in audit details. Existing `${UPLOAD_ROOT}/.openalex-key` ciphertext can still be read during migration; all new credentials use `ENCRYPTION_KEY`. Optional backend `OPENALEX_API_KEY` is a fallback until an administrator saves a setting; removing the key explicitly selects anonymous access. Rate limits and partial fetch failures back off without applying partial results. Articles, reviews, conference papers, book chapters and datasets are supported. Retractions go to review. Unsupported types or conflicting identifiers are recorded in the source's skipped summary; use the existing manual path for exceptions. Local corrections and contributor decisions survive refreshes of an unchanged author ID. Missing upstream works are recorded in the summary and retained until the link changes or is removed.

The schema is additive (`backend/prisma/migrations/20261012000000_openalex_author_sync/migration.sql`). Normal `db:seed` also applies it. Schema deployment does **not** clear existing papers. The destructive reset is a separate, local-only test command that never loads `.env`:

```bash
DATABASE_URL='postgresql://<local-user>:<local-password>@127.0.0.1:5433/amirl' \
  pnpm --dir backend research:reset:local \
  ../.local-verification/legacy-pre-openalex-20261012 --replace-local-papers
```

Stop local writers first. This command requires a matching SHA-256 legacy backup manifest and actual local database identity. It removes only paper records, their dependent links and demonstrably matched profile copies, preserving accounts, projects, datasets and unrelated profile fields. The legacy dump and uploads remain under `.local-verification/legacy-pre-openalex-20261012/`; do not commit them. Recover the dump into a **separate local recovery database** with `pg_restore --no-owner --no-acl --dbname=<explicit-local-recovery-url> database.dump`. Verify the recovered data and copied uploads before replacing an active database. Never use the hosted `.env` URL for this workflow.

Rollback-only integration checks require the same explicit local target:

```bash
DATABASE_URL='postgresql://<local-user>:<local-password>@127.0.0.1:5433/amirl' \
  pnpm --dir backend test:openalex:local
```
