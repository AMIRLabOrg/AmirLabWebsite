# AMIRLab

AMIRLab public research site and lab operating workspace, built with Next.js, NestJS, Prisma and PostgreSQL.

This handoff keeps the uploaded Scientific Index visual direction while migrating the frontend implementation to Tailwind utilities and shared React primitives. The Prisma schema remains unchanged.

## Frontend styling contract

- Component/page styling is written with Tailwind utilities directly in JSX.
- `frontend/src/app/globals.css` is the only source CSS file. It is reserved for Tailwind import, fonts, AMIRLab color/theme tokens, global element defaults, input/textarea pseudo-elements, keyframes and reduced-motion behavior.
- No CSS Modules, page-local CSS, CSS-in-TS selector dumps, embedded style tags or ordinary inline style objects are used.
- The real AMIRLab FF Mab wordmark font remains protected as the brand font.
- Keep the existing user-supplied `frontend/public/fonts/ff-mab.regular.ttf` in place; the stylesheet references that exact file.
- Shared interface patterns are React components, including the canonical square `ProfileAvatar`, button controls, form fields, tables, workspace record surfaces and loading presentation.
- Loading uses the real component tree. Data slots render in a temporary loading presentation and receive their values in place; separate `SomethingSkeleton` trees are prohibited.

Run the architecture checks with:

```bash
cd frontend
pnpm run verify
```

## Database and canonical seed

The canonical rebuild source is `backend/seed/amirl-site.json`. Source portraits live under `backend/seed/assets/people/` and are treated as immutable seed inputs, not runtime storage.

`db:rebuild` resets the schema data, imports the canonical dataset, converts source portraits into runtime WebP assets under `backend/storage/peoples/`, creates database `Asset` records and runs database verification.

Imported website content is review-first:

- people are registered internally but their scraped public profile content is staged for Profile review;
- papers enter `NEEDS_REVIEW`;
- contributor/person matches are `PROPOSED` until manually verified;
- imported project details enter project review;
- imported positions start as drafts.

## Local development

Requirements: Node.js 22+, pnpm, and PostgreSQL client/server binaries (`initdb`, `pg_ctl`, `psql`, `createdb`). Docker is optional.

### Backend

```bash
cd backend
pnpm install
pnpm run db:rebuild
pnpm run start:dev
```

The project-local PostgreSQL cluster runs on `127.0.0.1:5433`. Its Unix socket uses a short `/tmp/amirlab-pg-<uid>-5433` path so deeply nested checkout paths do not exceed PostgreSQL's socket-path limit.

Useful commands:

```bash
pnpm run db:start
pnpm run db:status
pnpm run db:stop
pnpm run db:rebuild
pnpm run db:verify
pnpm run db:cluster:reset
```

API: `http://localhost:3001/api`

### Frontend

In another terminal:

```bash
cd frontend
pnpm install
pnpm run dev
```

Frontend: `http://localhost:3000`

If pnpm reports that the frontend lockfile needs updating after the Tailwind dependency change, run the first install with:

```bash
pnpm install --no-frozen-lockfile
```

### Local admin

Development-only canonical rebuild credentials:

- email: `admin@amirl.local`
- password: `AmirlabLocal2026!`

Change these before any public deployment.

## Role and review behavior

- MEMBER: personal tasks, weekly reports, notifications, profile, research/project participation.
- MODERATOR: moderation/review work, not personal task or weekly-report submission surfaces.
- ADMIN: moderator capabilities plus organization/governance administration.
- Staff create papers/datasets/projects on behalf of a registered person rather than becoming the owner automatically.
- Papers and datasets use the `Papers & datasets review` queue. Published/rejected records remain manageable and can be reopened or edited back into review.
- Contributor name/source matches do not auto-link a person. A moderator must verify or manually link the relationship.

## Verification

See:

- `verification/VERIFICATION.md`
- `verification/page-audit.md`
- `verification/backend-workflow-audit.md`
- `frontend/e2e/route-smoke.spec.ts`

After both services and the rebuilt database are running:

```bash
cd frontend
pnpm run verify
pnpm run verify:e2e
pnpm run verify:visual
```
