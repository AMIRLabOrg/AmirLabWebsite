# OpenAlex profile-link migration plan

> Execute inline with one final review. The latest user instructions and [updated spec](../specs/2026-10-12-openalex-author-sync.md) supersede the earlier separate binding panel and retained-old-output design.

## Review Focus

- Changing/removing a published OpenAlex link immediately removes all of that person's previous paper/dataset outputs, including manual decisions; shared records for other people survive.
- Applying a profile change and clearing/rebinding its source is atomic and uses consistent lock ordering with a sync job.
- An old in-flight sync cannot recreate old outputs after the link changes or is removed.
- Partial cursor fetches and rate limits cannot apply partial results or erase approved data.
- Unchanged-ID refreshes preserve local corrections and rejected/manual contributor decisions.
- Local reset and schema work cannot touch hosted data or original account credentials.

### Task 1: CI repair
- [x] Repair unchanged safety-check failures; run local suites/contracts/builds.
- [x] Push the separately authorized repair; both remote CI runs are green on 8c94d352.

### Task 2: Existing profile-link binding
- [x] Add OPENALEX link type and normalization; remove separate panel/controller/DTOs.
- [x] Apply source changes in direct publish, single review and bulk review transactions.
- [x] Clear previous paper/dataset associations immediately; retain coauthor-owned records.
- [x] Verify member/admin and approval flows locally, including source removal.

### Task 3: API client and sync
- [x] Fixed host, pagination, bounds, optional key, malformed/429/404 handling.
- [x] Existing jobs, source revisions/backoff, hourly due check and daily interval.
- [x] Canonical paper/dataset imports, deduplication, local corrections and contributor decisions.
- [x] PostgreSQL rollback checks: idempotent shared papers, datasets, author order, missing upstream, collisions, immediate replacement/removal and coauthor preservation.
- [x] Complete live author sync and verify public outputs/idempotence.

### Task 4: Local legacy reset
- [x] Verify protected legacy dump/uploads checksums and actual local database identity.
- [x] Clear 201 papers; preserve 115 original users/people, project and non-paper profile data.
- [x] Use disposable accounts and explicit local runtime configuration; hosted .env unchanged.

### Task 5: Completion
- [x] Full backend/frontend suites, safety/lint/types/contracts and isolated builds.
- [x] One fresh read-only review of the Review Focus; fix important findings with regressions.
- [x] Report verified behavior, backup path and limitations. No migration commit/push/deploy.
