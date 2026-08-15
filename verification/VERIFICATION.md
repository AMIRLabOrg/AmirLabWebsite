# Verification

This handoff is based on the user's uploaded `code(1).zip` baseline. The frontend was migrated from CSS modules/page stylesheets to Tailwind utilities in JSX without intentionally redesigning the Scientific Index visual language.

## Executed in the handoff environment

- `frontend/src` contains exactly one CSS file: `src/app/globals.css`.
- `globals.css` contains the Tailwind import, font declarations, theme/color tokens, global element defaults, pseudo-element defaults, keyframes and reduced-motion behavior only.
- No CSS Modules, page stylesheets, `<style>` blocks, ordinary inline style objects, `const styles = { ... }` selector dumps, or giant `[&_.class]` migration wrappers remain.
- Shared generic buttons are centralized in `ButtonControl`, `ButtonLink` and `ButtonAnchor`.
- Repeated form field wrappers are centralized in `FormField`.
- One square `ProfileAvatar` implementation is reused by the public header, workspace shell, workspace chat and profile editor preview.
- Same-component loading verifier passes: the normal JSX data nodes receive loading presentation; there is no parallel skeleton component tree.
- 48 App Router `page.tsx` files are present, matching the uploaded baseline count.
- Frontend/backend/script TypeScript/TSX parser audit: 0 syntax errors.
- Local import audit: 0 unresolved local/alias imports.
- Workflow contract audit: 19/19 checks pass.
- PostgreSQL local controller JavaScript syntax check passes.
- Prisma schema SHA-256 remains `5fd185b7bc6e833c5e39109730b9d6d17f82397c3052d7d4862005d78923ac50`, matching the original schema.
- Canonical seed contains 114 people, 6 departments, 201 papers, 1 project, 5 positions, 111 source portraits and 188 known contributor-source relationships.
- Tailwind v4 design-system compiler successfully built CSS from the migrated JSX candidate set in this environment.

## Runtime/browser verification

A real Playwright suite is included at `frontend/e2e/route-smoke.spec.ts`. It checks public routes, admin workspace routes, desktop/mobile overflow, role-boundary redirects, avatar geometry, internal users/research visibility after database rebuild, dynamic record routes and review manageability.

The full live Next.js + NestJS + PostgreSQL suite could not be executed inside this sandbox because the repository dependencies and PostgreSQL server are not installed here and external package installation is blocked. This is not marked as passed. Run the E2E suite on the Fedora development machine after starting the real services:

```bash
cd frontend
pnpm run verify
pnpm run verify:e2e
pnpm run verify:visual
```

`verify:e2e` uses `http://127.0.0.1:3000` by default and the development admin credentials from the canonical rebuild. Override them with `AMIRLAB_E2E_BASE_URL`, `AMIRLAB_E2E_ADMIN_EMAIL`, and `AMIRLAB_E2E_ADMIN_PASSWORD` when needed.

`verify:visual` writes full-page desktop/mobile captures for departments, papers, people, login, workspace, papers/datasets administration, research review and people/accounts into `verification/runtime-screenshots/`.
