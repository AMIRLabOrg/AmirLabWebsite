# AMIRLab Backend

NestJS + Prisma/PostgreSQL API for AMIRLab.

## Run

```bash
pnpm install
pnpm run db:rebuild
pnpm run start:dev
```

The local API runs at `http://localhost:3001/api`. Local configuration is read from `.env`.

## Verify

```bash
pnpm run verify:production
```

Repository rules and implementation constraints are documented in [`../RULES.md`](../RULES.md).
