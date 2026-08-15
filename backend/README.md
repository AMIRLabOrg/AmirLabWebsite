# AMIRLab Backend

NestJS + Prisma/PostgreSQL API for the AMIRLab public research site and lab workspace.

## Canonical database rebuild

The development database is rebuilt from one reviewed file:

- `seed/amirl-site.json` — normalized AMIRLab people, departments, papers, projects, public positions and site content.
- `seed/assets/people/` — immutable source copies of the people images supplied with the project.

The runtime `storage/` directory is not seed data. During a rebuild, source people images are processed through the same image pipeline used for uploads and written as WebP files under `storage/peoples/`; matching `Asset` records are created and connected to `Person.avatarId`.

### Source policy

The current roster, public organization pages, positions and public-site facts were checked against `https://amirl.org/` on 2026-08-14. Detailed biographies, links, profile sections and publication records are normalized from the AMIR Lab source material supplied with this project because the live site exposes much of that data as free-form HTML rather than the database schema used here. The canonical JSON records the source URL for each imported person, department, paper and project.

Do not parse HTML during normal application startup. Update/review `seed/amirl-site.json`, then rebuild the database.

## Local PostgreSQL

Requirements on Fedora:

```bash
sudo dnf install postgresql-server postgresql
```

The project uses its own PostgreSQL cluster in `backend/.postgres/`; the system PostgreSQL service does not need to be enabled.

```bash
pnpm run db:start
pnpm run db:status
pnpm run db:stop
```

`pnpm run db:reset` is the normal content reset and is an alias for the deterministic canonical rebuild. `pnpm run db:cluster:reset` is the lower-level command that deletes and reinitializes the private PostgreSQL cluster itself; use it only when the local cluster is damaged or you intentionally want a completely new cluster.

## First setup / clean rebuild

```bash
pnpm install
pnpm run seed:validate
pnpm run db:rebuild
pnpm run start:dev
```

`db:rebuild` is destructive. It:

1. starts the project-local PostgreSQL instance if needed,
2. resets PostgreSQL to the current `prisma/schema.prisma`,
3. imports `seed/amirl-site.json`,
4. rebuilds runtime people images under `storage/peoples/`, and
5. runs database/storage integrity verification.

For an already-empty schema you can run only:

```bash
pnpm run db:seed
pnpm run db:verify
```

`db:seed` intentionally refuses to seed a non-empty database. Use `db:rebuild` when you want a deterministic reset.

## Local admin

Local credentials are read from `.env`:

```env
ADMIN_EMAIL=admin@amirl.local
ADMIN_NAME=AMIRLab Administrator
ADMIN_PASSWORD=AmirlabLocal2026!
```

Change them before any public deployment.

## Runtime storage

- People/profile images: `storage/peoples/YYYY/MM/...` for normal uploads.
- Seeded people images: `storage/peoples/<slug>-<checksum>.webp` after rebuild.
- CVs: `storage/cv/...`
- University logos: `storage/university-logos/...`

Only `storage/.gitkeep` belongs in source control. Rebuilt runtime files are generated from seed assets or uploads.

## Database source fields

`seed/amirl-site.json` uses the neutral names `sourceId` / `sourceUrl` for provenance. The existing Prisma/API columns `legacySourceId` / `legacyUrl` are intentionally retained for compatibility with the original backend and current frontend; the rebuild maps the neutral seed fields into those columns. The old one-off extractor/importer and migration helpers have been removed, so `seed/amirl-site.json` is now the only content-import boundary.

## Useful commands

```bash
pnpm run seed:validate
pnpm run db:start
pnpm run db:reset
pnpm run db:cluster:reset
pnpm run db:generate
pnpm run db:push
pnpm run db:seed
pnpm run db:verify
pnpm run db:rebuild
pnpm run start:dev
pnpm run test
pnpm run build
```
