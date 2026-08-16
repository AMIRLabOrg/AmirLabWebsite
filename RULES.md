# AMIRLab Engineering Rules

These rules define the repository's implementation and review contract. They are contributor rules, not end-user setup documentation.

## 1. Production gate

A change is not ready to hand over or merge until the relevant production checks pass.

```bash
pnpm run verify:production
```

Do not substitute syntax transpilation or custom grep checks for the TypeScript compiler or framework build. If dependencies or infrastructure make a production check impossible, state exactly which check was not run.

## 2. Type safety

- Keep backend and frontend TypeScript strict.
- Do not use `as never` anywhere in the repository. Do not use double assertions such as `as unknown as ...` or non-null assertions in production source. Narrow, validate, serialize, or use dependency-injection test doubles instead.
- Narrow nullable values before asynchronous callbacks and capture the narrowed primitive/object when TypeScript cannot preserve the narrowing across a closure.
- Treat Prisma `Json` as an untrusted boundary. Convert or validate JSON into the expected object shape before using it; do not blindly cast arbitrary `JsonValue` to an input object.
- Prefer explicit domain types and type guards to assertions.
- Service-constructor changes must update unit-test providers in the same change. Backend typechecking includes `*.spec.ts`; a test suite that no longer constructs its service is a compile failure, not a test-only cleanup item.

## 3. PostgreSQL and Prisma

- PostgreSQL is the source of truth for relational state.
- Use set-based SQL/Prisma bulk operations for bulk review actions; do not loop through single-item endpoints.
- Multi-table state transitions that must succeed together belong in a transaction.
- Queries on the same interactive transaction client must be sequential. Never use `Promise.all()` with operations that share a `Prisma.TransactionClient`.
- Parallel reads are allowed only when they use the normal pooled Prisma client and do not share a pinned transaction connection.
- Do not expose Prisma, PostgreSQL, DTO-property, or stack-trace details through public API errors.

## 4. Canonical seed and ordering

- `backend/seed/amirl-site.json` is the canonical local rebuild source.
- Profile section/subsection order in seed JSON is the array order. Do not add seed `sortOrder` fields for those arrays.
- Database `sortOrder` values are derived when array data is persisted because relational rows have no implicit order.
- Imported public content remains review-first unless the workflow explicitly says otherwise.
- Do not invent profile facts to fill sparse source data.

## 5. Profile schema

Profile content uses:

```text
Section
└── Subsection
    └── Entry
        ├── label?    optional
        └── content   required
```

`label` is metadata for an entry, not another nesting level. Dates, technologies, roles, institutions, and descriptions must be attached to the record they describe rather than emitted as unrelated numbered entries.

## 6. Research records and profiles

- A published canonical paper/dataset is authoritative over a duplicate manually-entered profile record.
- Contributor relationships must be verified before a registered person is linked.
- Matching candidates may preselect the best registered person, but the moderator must be able to search and override the selection.
- Match confidence must be shown consistently; weak one-token overlaps must not be presented as strong candidates.
- When a canonical output is approved, normalize equivalent pending/published profile data instead of creating duplicates.

## 7. Review UI

- Item-specific failures belong on the affected item, not as raw page-level backend text.
- Use semantic status presentation consistently: error, warning/pending, success, info, neutral.
- Bulk actions expose only actions valid for every selected item, and the backend rechecks the guards.
- Master/detail review pages keep the detail pane available while the queue scrolls on desktop; mobile may stack normally.
- Review queues should remain bounded and paginated rather than making the entire page as tall as the queue.

## 8. Shared frontend primitives

- Native form controls are encapsulated in shared UI components.
- Button and link actions use the shared action system and consistent variants.
- Repeated status, field, avatar, table, loading, and review patterns belong in shared components.
- Do not introduce page-specific copies of an existing control.
- Loading states should preserve the real component structure rather than swap in unrelated skeleton trees.

## 9. Brand

- The approved AMIRLab wordmark is derived from the supplied FF MAB reference and is stored as the self-contained `frontend/public/amirlab-wordmark.png` asset.
- The wordmark is `Amir` in brand blue and `Lab` in ink/black.
- Public and workspace navigation use the same brand component and asset.
- Do not reintroduce a runtime dependency on an unbundled font file or replace the wordmark with a visually different fallback implementation.

## 10. Authentication and password recovery

- Password reset uses the account login email, not the optional public profile email.
- Store only a cryptographic hash of a reset token.
- There is at most one active reset record per user; a new request replaces it.
- An expired reset record is deleted when that expired link is presented.
- Password-reset requests do not reveal whether the submitted account exists.
- A successful reset revokes existing sessions.
- Raw reset URLs must not be persisted in the normal mail-job payload store.

## 11. Errors and observability

- Log internal causes server-side with enough context for diagnosis.
- Return stable domain codes and safe public messages to the frontend.
- Frontend copy must describe what the moderator/user can do next; never render raw validation paths such as `profile.publicEmail`.
- Deprecation warnings must be investigated before dependency upgrades make them failures.

## 12. README policy

`README.md` explains what the repository is, its prerequisites, how to configure it, how to run it, and how to verify it. Architecture constraints, contributor rules, implementation invariants, and agent/developer guidance belong here in `RULES.md`, not in the README.
