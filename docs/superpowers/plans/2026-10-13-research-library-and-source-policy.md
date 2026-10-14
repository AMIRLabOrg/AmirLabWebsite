> Updated 2026-10-14: the user requested a fresh local database and fresh canonical seed. Legacy-data conversion and preservation are superseded; no conversion script is retained. Hosted rollout remains separate.

# Lab Projects, People and Published Outputs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline task-by-task, with one fresh-context review at the end. Steps use checkbox (`- [ ]`) syntax for tracking. No implementation delegation is required.

**Goal:** Deliver reliable lab project progress and independent publication references alongside a source-readonly OpenAlex catalogue with exact person attribution and safe retention.

**Architecture:** Reuse ProjectsService, ResearchService/OpenAlexService, PostgreSQL Job, per-identity advisory locks, profile review, shared frontend controls and local recovery tools. Separate ordered source authors, current person-output associations, retained associations and external project/program references. Database-changing jobs commit their effects, derived ranks, cache revision and terminal status together; only external webhook delivery is queued afterward through a job created in that transaction.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Next.js/React, Jest, Vitest; Node 24.9+ with VM modules for current backend tests. No new broker or runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-13-lab-projects-people-and-outputs-design.md` (SRE/SQA-revised version).

## Global constraints

- This revision changes documentation only. Implementation, commit/push/deploy and hosted data operations are separate stages; no approval is inferred from a plan checkbox.
- Preserve unrelated dirty worker/mail/settings work. Existing inline execution preference carries forward when implementation is authorized; do not ask the same execution-method question again.
- Previously authorized destructive cleanup is only `127.0.0.1:5433/amirl`. Never inherit backend/.env's hosted URL. Rehearsals create guarded local fixture DBs matching `amirl_sqa_*` on that container.
- Preserve all 115 people/accounts, current lab projects, universities and known author IDs in the authorized local cleanup. Inspect changed counts before proceeding.
- Exact author-ID evidence only; one canonical work; no manual catalogue entry/edit/review, Scholar sync, name matching or abstract intake.
- An omitted author-ID field preserves the effective binding; explicit null clears it. Member changes apply through existing profile approval; admin changes apply directly.
- Retained and current associations both protect an output from deletion. Account trash/alumni status is not Person removal. Independent DOI/URL references have no output-catalogue FK.
- Job bounds: lease 90 s; heartbeat 15 s; recovery sweep 30 s; source attempt 5 min; HTTP request 20 s; commit transaction 60 s; maximum 50 pages/5,000 unique works. Larger results fail incomplete without reconciliation.
- Concurrent bounded worker pool: JOB_CONCURRENCY defaults to 8 per process, validated 1–32; no single-OpenAlex lane. Database connection/provider budgets govern actual admission, reserving HTTP/control capacity. Claims/leases fence all instances. No exactly-once claim for SMTP.
- Preserve skeleton/loading, dirty-form and accessible shared-field behavior; read frontend/AGENTS.md and relevant installed Next.js docs before frontend code.
- Run fresh verification at every test cycle; previous 8/18 passing tests are historical evidence only. Keep changes reviewable without committing until asked.

## Review focus

1. Immediate restart before lease expiry must still recover a crashed job; a stale worker cannot commit after takeover (Tasks 2, 4, 12).
2. Crash immediately before/after the atomic commit must leave either old state or complete new outputs/ranks/revision/job state (Tasks 3, 4, 12).
3. P's delayed source observation cannot overwrite Q's newer retraction; Q's independent association cannot be lost (Tasks 4, 5, 12).
4. Person deletion racing with a new association must retain the output; inactive associations still count (Tasks 5, 12).
5. Populated legacy references without DOI, interrupted migrations, restored encrypted settings and old pending profile payloads must fail/preserve safely (Tasks 6, 7, 11, 12).

## File responsibilities and delivery phases

Foundation: schema/migrations, `jobs.service.ts`, `job-context.ts`, `public-cache.service.ts`, rankings transaction support and response allowlists. Catalogue: OpenAlex client/importer/service, profile payload/application, research queries/routes/library, deletion policy and retired handlers. Project workflow: project DTO/service/UI, weekly reports and research programs with independent references. Cutover: seed writers, local migration/preflight, populated fixtures, recovery tests and browser acceptance. Reuse existing services; split a file only if a distinct reusable responsibility actually emerges.

All task test steps use this cycle: add the named regression and watch it fail for the intended reason; implement the stated contract; rerun it and the affected caller tests; record command/output and files in the task ledger. Do not mark a task complete from typecheck alone.

### Task 1: Define additive schema and protect response/history boundaries

**Files:** Modify `backend/prisma/schema.prisma`, `backend/src/projects/projects.service.ts`, `backend/src/users/users.service.ts`; create `backend/prisma/migrations/20261013020000_lab_output_foundation/migration.sql`, `backend/test/lab-schema.local.integration.ts`; extend existing project/user/weekly-report specs.

**Interfaces/data:** Add `PersonResearchItem(personId, researchItemId, authorId, isCurrent, confirmedAt, missingSince)` with composite primary key; Person FK Cascade, ResearchItem FK Restrict. Add `ResearchSourceSnapshot.observationVersion BigInt default 0` and SQL sequence `OpenAlexObservationSequence`. Add `Job.leaseToken`/`leaseExpiresAt` and `OpenAlexProfile.boundAt`; exclude internal BigInt observationVersion from every API DTO and test JSON serialization before retiring old routes. Add `Project.closingNote`. Introduce `ProjectOutputReference(id, projectId, label, doi?, url?, identityKey, legacyReferenceKey?)` and `ResearchProgramOutputReference` with the analogous program ID; no catalogue FK. Unique parent/identity and parent/legacy-reference keys support dedupe and reruns. Change WeeklyReport author FK to Restrict. Keep old relationships until verified conversion.

- [ ] Add tests `nested_project_responses_exclude_credentials` and `purge_cannot_delete_report_author`, plus schema assertions that a retained association blocks output deletion and independent references survive it.
- [ ] Run focused project/user/report suites and isolated PostgreSQL schema test; confirm the secret-field and FK regressions fail before implementation.
- [ ] Implement additive structures and explicit account/person field selects in project list/detail/update/task results. Do not return invitation token hashes. Preserve historical contributor display names; require ownership reassignment before physical Person removal.
- [ ] Run schema validation, focused regressions and API-boundary verification; inspect nested arrays rather than only top-level keys.

### Task 2: Make queue recovery, fencing and cancellation reliable

**Files:** Modify `backend/src/jobs/jobs.service.ts`, `job-context.ts`, `jobs.service.spec.ts`, `jobs.controller.ts`, `backend/src/config/environment.ts`/spec; create `backend/test/jobs-recovery.local.integration.ts`.

**Interfaces:** Extend `JobContext` with `leaseToken: string` and optional `deadlineAt: Date`. Add `JobsService.assertActiveJob(tx: Prisma.TransactionClient, context: JobContext): Promise<void>` (non-locking validation) and `completeJob(tx: Prisma.TransactionClient, context: JobContext): Promise<void>` (final conditional update). The final update requires the current token, RUNNING state, unexpired lease/deadline and null cancelRequestedAt; zero rows throws, rolling back the whole transaction. Do not hold the Job row lock while writing imports. Cancel requests update the existing job directly and abort its owner; they are never enqueued as a separate job. Generic completion tolerates a job already atomically completed by its handler. Claim/heartbeat/recovery/terminal transitions are compare-and-set operations.

- [ ] Add `restart_before_expiry_recovers_on_sweep`, `healthy_long_job_is_not_reclaimed`, `stale_token_cannot_complete`, `cross_instance_cancel_is_observed`, `cancel_after_five_uncommitted_writes_rolls_everything_back`, `cancel_success_race_has_one_atomic_winner` and `cancel_after_commit_is_not_cancellable` tests.
- [ ] Run them against two worker instances in a guarded local fixture DB; demonstrate startup-only recovery and unfenced completion failures.
- [ ] Implement 15 s heartbeat/30 s sweep/90 s lease; persisted cross-instance cancellation; atomic claims into the configurable concurrent pool, fair priority/aging and admission within DB/provider capacity. Run multiple different-person OpenAlex jobs concurrently; prevent same-person overlap. Fetching/waiting holds no transaction. Reject retry for retired/unregistered handlers. Terminal/cancel handlers cannot mutate a newer binding.
- [ ] Rerun race/recovery tests plus existing jobs/mail/push tests; prove several source jobs overlap, independent imports can commit concurrently, matching work identities serialize and prioritized general jobs remain responsive under the measured budget.

### Task 3: Make ranks and cache changes durable

**Files:** Modify `backend/src/research/rankings.service.ts`/spec, `backend/src/public-cache/public-cache.service.ts`/spec, `backend/src/jobs/job-types.ts` only if needed.

**Interfaces:** Extend `RankingsService.recalculateMany(personIds: readonly string[], actorId?: string, db?: Prisma.TransactionClient): Promise<void>` so supplied transactions contain all rank/metric writes and required notification-job records; existing callers without db retain an owned transaction. Add `PublicCacheService.invalidateInTransaction(tx: Prisma.TransactionClient, changeKey: string): Promise<void>` which advances `cache.public.revision` and inserts a unique `REVALIDATE_PUBLIC_CACHE` delivery job. Delivery does not replace the stored revision with an older value. No new rank-job type is needed.

- [ ] Add `rollback_preserves_ranks_revision_and_delivery_queue`, `committed_delivery_survives_restart`, `duplicate_webhook_does_not_regress_revision`, and `unchanged_sync_does_not_invalidate`.
- [ ] Run focused rankings/cache tests and local transaction checks; demonstrate the current post-commit gap.
- [ ] Implement caller-owned transaction support and durable webhook enqueue; remove blanket source-sync settled invalidation. Keep network calls outside data transactions and rank notifications idempotent through existing unique event/job keys.
- [ ] Rerun caller tests and outage cases. Changed citation/membership/retraction affects ranks; changed visible title affects cache; no-change observations may update freshness markers but do not rewrite canonical metadata or ranks.

### Task 4: Import authoritative source snapshots without disturbing people

**Files:** Modify `backend/src/research/openalex-client.ts`/spec, `openalex-importer.ts`/spec, `openalex.service.ts`/spec, `research-identity.ts`; extend `backend/test/openalex-local.integration.ts`.

**Interfaces:** Export `OpenAlexAuthorSnapshot = { works: OpenAlexWork[]; presentWorkIds: string[]; declaredCount: number; warnings: { workId: string; reason: string }[] }`. `fetchAuthorWorks(authorId: string): Promise<OpenAlexAuthorSnapshot>` validates the full envelope; malformed/unidentifiable rows, inconsistent counts/cursors/duplicates and exceeded limits throw an incomplete-response error. Valid-ID rows with unusable metadata remain present IDs with warnings. `OpenAlexImporter.apply(profile, snapshot, observationVersion: bigint)` returns changed output/person IDs and the sync summary. `OpenAlexService.sync(personId: string, version: number, context: JobContext): Promise<void>` captures next observation sequence value before network fetch and commits every accepted record in one transaction under per-identity/binding guards and a final lease/cancellation success update. Replace the old whole-import global mutex with sorted work-ID/DOI locks, expanding/retrying the set before writes if rechecking finds another identity.

- [ ] Add `older_observation_cannot_reverse_retraction`, `author_reorder_preserves_memberships`, `unchanged_work_still_adds_second_person`, `invalid_present_work_keeps_last_good_listing`, `count_mismatch_and_page_failure_do_not_reconcile`, `empty_result_requires_exact_author_and_zero_count` and `two_complete_jobs_confirm_absence`.
- [ ] Run client/importer/service suites and the local shared-work integration tests; see the old positional attribution/write behavior fail.
- [ ] Batch-load canonical records/associations; fingerprint selected source metadata; adopt only exact existing identifiers and report conflicting DOI/work IDs per item. Reuse source-author rows for readonly display, never as person ownership. Apply metadata only for newer observationVersion; batch-advance freshness for unchanged accepted metadata. Exact independent attribution is separate from metadata freshness, but never activates an unusable/retracted output publicly.
- [ ] For absent IDs: first accepted complete job sets missingSince; another accepted complete job for the same effective binding confirms absence. Returned valid work IDs clear the suspicion even when other metadata is invalid, preserving last-good attribution without adding a new one. Failed/stale/cancelled/incomplete jobs change neither state. ID replacement immediately deactivates old current associations.
- [ ] Commit outputs, memberships, profile status/citations, affected ranks, required revision/delivery and SUCCEEDED together. A direct cancel request that wins the final success-update race rolls back all records, even after five uncommitted writes; successful commit first means already applied. Run all focused tests and kill-before/after-commit integration assertions.

### Task 5: Enforce safe Person removal and output cleanup

**Files:** Modify `backend/src/users/users.service.ts`/spec, `users.controller.ts`, `frontend/src/components/user-management.tsx`, `backend/src/research/research.controller.ts`, `research.service.ts`, `backend/src/jobs/job-types.ts`; create `backend/src/research/research-retention.service.ts`/spec and `backend/test/research-retention.local.integration.ts` only to centralize the genuine shared deletion responsibility.

**Interfaces:** `ResearchRetentionService.removePerson(personId: string, actorId: string): Promise<void>` validates admin/ownership/self/last-admin preconditions, takes Person/binding locks without output locks, captures association IDs, revokes sessions and trashes the linked retained account, removes that Person and queues `CLEANUP_RESEARCH_OUTPUTS { outputIds: string[] }` in the same transaction. Cleanup checks only those PAPER/DATASET IDs under matching sorted per-output identity locks and the restrictive FK; it never performs check-then-delete outside the transaction. Expose DELETE /people/:personId on ResearchController with ADMIN authorization, distinct from account trash; update user-management.tsx to distinguish these actions and their ownership errors. Login-account deletion and alumni operations never invoke this physical deletion path.

- [ ] Add `inactive_association_blocks_delete`, `account_trash_does_not_remove_person`, `remove_first_coauthor_retains_output`, `remove_last_person_allows_cleanup`, `new_association_racing_cleanup_wins_safely` and `cleanup_candidates_survive_removal_crash`.
- [ ] Run the local race tests and verify count-then-delete without a constraint fails.
- [ ] Implement targeted idempotent cleanup, distinguish FK-retained candidates from unexpected errors, and recalculate affected metrics/revision transactionally. Do not add a global orphan sweep. Restrict the physical remove endpoint to admin and block ownership-bearing active people until reassigned.
- [ ] Rerun shared-output and restored-account tests; verify independent references survive canonical deletion and reports/history are not cascaded away.

### Task 6: Make profile binding and all output queries consistent

**Files:** Modify `backend/src/profiles/profile-payload.ts`/spec, `profiles.service.ts`/spec, `backend/src/research/openalex.service.ts`, `research.service.ts`/spec, `research-profile-sync.service.ts`/spec, `rankings.service.ts`, `frontend/src/components/profile-editor.tsx`/test, `frontend/src/lib/types.ts`.

**Interfaces:** Parsed payload has `openAlexAuthorId?: string | null` separate from ordinary links. Replace `applyLinks` callers with `OpenAlexService.applyAuthorId(personId: string, authorId: string | null | undefined, tx: Prisma.TransactionClient): Promise<boolean>`; omission is no-op. Acquire Person/binding locks without acquiring output locks afterward; set boundAt only when the effective ID changes, deactivate old listings, reset citations, increment binding version and record required jobs/ranks/cache in the owning transaction. Legacy pending payload conversion preserves omission semantics.

- [ ] Add `pending_member_change_does_not_sync`, `approved_change_replaces_only_own_current_links`, `rejected_change_preserves_binding`, `admin_applies_directly`, `omitted_field_preserves_and_null_clears`, `old_pending_payload_is_safe` and denied cross-person edit tests.
- [ ] Run backend profile/payload/OpenAlex/query tests and profile-editor tests; demonstrate current coupling/omission behavior before changing it.
- [ ] Move public/profile/rank queries to current independent associations; public person eligibility excludes account trash but not PENDING_SETUP. Staff retained-library access does not make retained records public. Readonly source-author profile links resolve only through that output's current independently confirmed associations.
- [ ] Remove manual publication/dataset profile section creation and ignore/reject such input on the server consistently; preserve unrelated education, awards and project sections. Display pending/effective ID and last-good sync state without a second matching/review system.
- [ ] Rerun affected tests, checking a person with no ID can still use projects and an admin-published seeded member remains publicly visible.

### Task 7: Make project/program references independent and simplify reports

**Files:** Modify `backend/src/projects/dto/project.dto.ts`, `projects.service.ts`/spec, `projects.controller.ts`, `frontend/src/components/project-workspace.tsx`; modify research-program DTO/service/spec/UI, weekly-report DTO/service/spec/UI and shared types; create `backend/test/project-references.local.integration.ts` and corresponding frontend tests.

**Interfaces:** Existing `POST /projects/:id/outputs` accepts `{ label, doi?, url? }` instead of outputId; `DELETE /projects/:id/outputs/:referenceId` permits managers to remove a reference. Normalize DOI to identityKey `doi:<normalized>`; URL-only uses normalized HTTPS identityKey `url:<url>`; reject credentials/controls/schemes. Do not resolve external URLs on save. Program reference operations use the analogous record and existing admin save interface; preserve PROJECT rows in ResearchProgramItem and convert only PAPER/DATASET rows. Legacy weekly-report references append one labelled source-URL block to accomplishments per stable output UUID, leaving the original text intact and detecting that marker on reruns. SaveWeeklyReportDto removes outputIds, retains projectIds and narrative fields.

- [ ] Add `doi_aliases_dedupe_within_project`, `reference_without_catalogue_saves`, `catalogue_delete_preserves_reference`, `binding_change_preserves_reference`, `unsafe_reference_rejected_without_network_fetch`, `program_project_links_survive` and report-preservation tests.
- [ ] Run reference/report/program backend tests and UI tests; verify catalogue-FK coupling fails the independence requirement.
- [ ] Update old output selector to DOI/URL/label inputs and remove linkedOutputId/report-output submission paths. Converted historical references remain readable as plain text/source URLs; new reports do not list published papers as required evidence.
- [ ] Verify manager/viewer access, duplicate errors in reserved message space, long DOI/URL layout, no manual catalogue intake, and reference behavior when DOI enrichment has no match.

### Task 8: Replace manual research surfaces with a durable readonly library

**Files:** Modify `backend/src/research/research.controller.ts`, `research.service.ts`, `research.module.ts`; create `backend/src/research/dto/research-library-query.dto.ts`, `frontend/src/components/research-library.tsx`/test, `frontend/src/app/workspace/submissions/[id]/page.tsx`; modify existing submissions/new/research routes, navigation, indicators, admin settings and worker labels. Delete obsolete submission/review/contributor-claim components/services/tests only after checking callers; adapt boundary/recovery verification scripts.

**Interfaces:** Authenticated `GET /research-library?page=1&pageSize=20&type=PAPER|DATASET&search=...&view=current|retained|issues` returns `{ items, total, page, pageSize, totalPages }`; cap pageSize at 50. `GET /research-library/:id` scopes members to current own works; retained/issues views require staff. Metadata has no write endpoint. Old manual creation/claim/discovery/review routes are removed; old UI deep links redirect to the library/details where applicable.

- [ ] Add library published/retained/pagination tests, denied unrelated-member detail/view tests, and API 404 assertions for retired writes.
- [ ] Run focused backend/frontend tests; see old creation/review UI and access rules fail the new contract.
- [ ] Build the searchable readonly library using existing FormField, SelectControl, PaginationControls and output-card styles. Source links remain clear and consistent. Remove unused new-paper/dataset review policy controls and review badges; cancel pending obsolete jobs without deleting history.
- [ ] Verify loading, empty, error, pagination and small-screen states. Assert retired job types cannot be re-enqueued/retried and do not remain active dropdown choices without history.

### Task 9: Repair project progress, concurrency and closure

**Files:** Modify project DTO/service/spec, project-access helper, project-workspace UI and existing project creation/review UI; create `frontend/src/components/project-workspace.test.tsx` and `backend/test/project-progress.local.integration.ts`.

**Interfaces:** Project update DTO requires expectedVersion: number and nonempty closingNote (max 2,000 characters) for COMPLETED, plus acknowledgeOpenTasks: true when tasks remain open; a conflict returns 409 without overwriting newer edits. Milestone replacement requires expectedVersion: number, retains supplied IDs belonging to that project and gives IDs only to new rows. Task writes use project-lock allocation/max-position, active member ownership validation and expectedUpdatedAt: string for edits. `GET /projects/mine` adds validated page/pageSize/view (`active|completed|archived|all`), returns paginated summary DTO; workspace detail excludes unbounded task/update arrays and supplies whole-project task/milestone/deadline counts. GET /projects/:id/tasks, /projects/:id/updates and /projects/:id/change-requests accept page/pageSize with a cap of 50 and return paginated rows. Summary counts must not use only the visible page.

- [ ] Add `blocked_80_percent_stays_80`, `milestone_id_and_update_reference_survive`, `private_weights_require_100`, `no_milestones_progress_is_null`, `delete_middle_then_create_succeeds`, concurrent-create/ stale-edit/ completedAt-preservation tests, and inverted-date/member-owner validation and whole-project summary-count tests.
- [ ] Run unit/local integration tests and see the existing destructive replacement/count ordering fail.
- [ ] Implement stable in-place milestone edits with safe temporary ordering for unique constraints; consistent weights, sorted lock order, compare-and-set versions and separate task progress. Preserve completion time on text-only DONE edits. Closure requires a note and explicit acknowledgement when tasks remain open; publication reference is optional.
- [ ] Make authorized internal edits direct; retain public visibility/archive review decisions. Remove unused newProject review toggle. Show controls by access, add searchable archive view, and paginate summary/tab history without dropping existing skeletons.
- [ ] Verify PLANNED/ACTIVE/PAUSED/COMPLETED separately from public visibility/archive, archived read-only server enforcement, unarchive access and history continuity.

### Task 10: Surface quota, freshness and useful operational status

**Files:** Modify `backend/src/settings/settings.service.ts`, OpenAlex client/service, jobs summary/controller DTO, `frontend/src/components/openalex-api-settings.tsx`, `workers-monitor.tsx`/test and shared types; extend settings/client/jobs specs.

**Interfaces:** Shared SiteSetting pause records `{ credentialFingerprint, resumeAt, reason }`; no raw secret. Existing summary response adds oldest pending age, expired leases/recoveries, stale/never-synced profiles, oldest delivery failure and item-conflict counts. Source summaries distinguish SUCCEEDED with warnings from FAILED/deferred; this need not add a database job enum.

- [ ] Add `second_profile_does_not_call_after_shared_429`, `manual_retry_respects_pause`, `new_valid_key_has_independent_pause`, `unknown_budget_is_not_zero`, `stale_after_48_hours` and warning/failure UI tests.
- [ ] Run client/settings/workers tests; verify the previous per-profile retry storm and misleading status fail.
- [ ] Check the pause before every request, apply provider retry time/one-hour fallback and five-minute deterministic resume jitter; keep existing encrypted key validation-before-save. Show last successful data separately from latest attempt. Health targets are visibility/alert rules, never reasons to delete data.
- [ ] Verify concurrent sync backlog does not starve cache/mail/push and workers remain paginated with every registered active type plus labelled historical retired types.

### Task 11: Fresh local database and canonical seed (revised by user)

The user explicitly replaced legacy preservation/conversion with a fresh database and fresh seed on 2026-10-14. No converter or legacy transformation is required.

- [x] Remove manual papers and output sections from the canonical seed; retain all 114 real people, 58 known IDs, academic partners and separate projects.
- [x] Seed OpenAlexProfile directly with author ID and binding date, without duplicating IDs in PersonLink or draft profile links.
- [x] Stop the local backend, verify the exact 127.0.0.1:5433/amirl target, reset its schema and run the fresh seed.
- [x] Verify seed and assets before starting automatic sync.
- [x] Start the local backend and verify real outcomes: 58 successful author profiles, 1,187 shared catalogue outputs and 58 successful cache deliveries.
- [x] Leave hosted databases and deployment untouched.

### Task 12: Prove recovery, security and UI acceptance; obtain final review

**Files:** Extend the local integration fixtures and existing `backend/scripts/restore-local-backup.ts` usage/tests; create `backend/test/lab-recovery.local.integration.ts`; update frontend tests and the task ledger/evidence section of this plan. No production backup is requested.

**Interfaces/checks:** Isolated fixture recovery uses dummy encrypted settings and a test ENCRYPTION_KEY outside the dump. Matching key decrypts; missing/wrong key returns an explicit configuration/decryption error without replacing credentials. Restored outputs/associations/references remain semantically identical. Process-kill harness waits on transaction checkpoints, never arbitrary sleeps, and restarts the same guarded fixture worker.

- [ ] Add failures before commit, after commit, after lease takeover and after Person removal; assert outputs, associations, ranks, revision and terminal job together. Rehearse restore and repeated follow-up delivery. No mock-only substitute for PostgreSQL constraints or process recovery.
- [ ] Run focused backend suites under Node 24.9+ with `--experimental-vm-modules`; full backend tests, frontend `pnpm exec vitest run --testTimeout=15000 --maxWorkers=1`, typecheck/lint, Prisma validation and repository safety/API/recovery checks. Allow local sockets through appropriate approval where required; do not treat sandbox bind failures as passed.
- [ ] Verify browser member/viewer/manager/admin actions, pending vs effective IDs, source-readonly library, DOI references, archive, responsive forms and pagination; preserve pending/skeleton and connection-outage views. Use existing local accounts/password manager without printing/copying passwords into artifacts.
- [ ] Run a 1,000-work fixture including changed/unchanged coauthored records; measure query growth, commit timeout, queue latency and memory against bounds. Mark any untested upper bound explicitly; do not claim 5,000-work capacity from this fixture.
- [ ] Obtain one fresh-context whole-change review authorized by the executing-plans skill, fix concrete findings and rerun affected checks. Leave work uncommitted/unpushed until separately instructed.

## Traceability and release evidence

| Reviewed finding | Owning tasks | Required evidence |
|---|---|---|
| Checklist omitted final design | 1–12 | Every design section maps to these tasks |
| Worker stuck/reclaimed incorrectly | 2, 12 | Two-worker, restart and stale-token DB tests |
| Commit leaves ranks/cache behind | 3, 4, 6, 12 | Before/after-commit kill tests and durable delivery |
| Older metadata reverses newer source | 4 | Reversed observation/retraction fixture |
| Cleanup races association creation | 1, 5, 12 | Restrictive FK and concurrent cleanup fixture |
| Zero-link migration proves nothing | 7, 11 | Populated, missing-ID and interrupted migration fixtures |
| Ambiguous binding/cancel/absence rules | 2, 4, 6 | Approval, omission/null, cancellation and two-success tests |
| Sync monopolizes queue/quota | 2, 10, 12 | Concurrent pool/priority latency, shared-pause and retry checks |
| Restore loses encrypted settings | 12 | Isolated dummy-secret restore/key mismatch tests |
| Credential leaks/project data defects | 1, 9, 12 | Nested response and progress/history/concurrency tests |

Previous evidence retained: the last-binding-clear regression failed on physical output deletion and passed after removal of that path (eight service tests); three related project/report/program suites passed 18 tests. These are not proof of this revised design. All tasks above remain pending implementation and fresh verification.

Documentation review checklist: compare interface names across tasks; verify per-identity lock order, cancellation commit point, transaction ownership, presence/absence semantics and migration stages agree with the spec; scan for unresolved alternatives/placeholders; ensure fixtures cannot read hosted credentials or mutate hosted data. Record actual commands, counts and environmental limits during execution.
