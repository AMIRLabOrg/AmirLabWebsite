> Updated 2026-10-14: the user requested a fresh local database and fresh canonical seed. Legacy-data conversion and preservation are superseded; no conversion script is retained. Hosted rollout remains separate.

# Lab projects, people, and published outputs

Status: revised after SRE/SQA review; proposed design for review. This document describes intended behavior, not completed implementation. It supersedes the research-library-and-source-policy design where their rules differ. No product code or database change is authorized by this document alone.

## Purpose and boundaries

Support real lab work from a research question through execution, manuscript preparation, publication and closure. Keep that working history separate from the published-output catalogue. OpenAlex supplies papers/datasets and citation data; it does not determine project membership, progress, completion, or project-output references.

Reuse the existing NestJS services, Prisma/PostgreSQL store, job queue and frontend controls. Do not introduce a second research provider, manual output editor, generic workflow engine, or separate copy of each paper per person. Keep the existing common ResearchItem base for compatibility; PROJECT records are owned by ProjectsService, while PAPER/DATASET records are owned by OpenAlex import. They have separate operations and lifecycles even if their base table is shared.

## Options and recommendation

1. Continue attaching person identity to ordered source-author rows: smallest schema change, but metadata edits and author reordering can disturb attribution. Reject.
2. Independent person-output associations plus independent project DOI/URL references: modest changes with clear ownership and deletion behavior. Recommend.
3. Full generic provenance, manuscript and publication workflow/versioning framework: substantially more code and policy than the lab currently needs. Defer.

## People, accounts, and access

A Person is the lab identity; a User is the login account. Person visibility, login eligibility, project membership and OpenAlex binding are independent decisions. A person can have no OpenAlex ID and still participate fully in projects. PENDING_SETUP accounts can have administrator-published profiles without being able to sign in yet.

Retain existing profile-review policy for member-written biography/profile changes. Administrator profile creation/edits can publish directly under the existing rules. OpenAlex IDs are edited in their dedicated field, not stored as ordinary profile links or manually editable paper metadata. A member proposes an ID change in the existing profile-review payload; it changes the binding and listings only when that payload is approved. Rejection leaves the existing binding untouched. Administrator direct edits apply immediately. An omitted ID field preserves the binding; explicit null clears it. The form distinguishes pending and effective IDs. Do not introduce a second confirmation/review system for author matching.

Store one normalized author ID per person, unique across current bindings. Validate format and reject a binding already used by another person. The first source sync validates actual existence; provider outages/quota errors appear as sync failures rather than triggering a guessed replacement. The user/admin selects the ID. Never identify someone by matching their name, Google Scholar ID, or a coauthor name.

Account deletion/trash revokes sessions and access; a trashed account also hides its public person listing until restored. It is not physical Person removal. Alumni status is also not deletion. Actual Person removal is a separate explicit administrator operation that must reassign ownership of active projects first. It also revokes the linked account's sessions and marks that account in trash while retaining it for historical foreign keys; self-removal and removal of the last active administrator are rejected. Automatic login-account purge must not silently cascade-delete weekly reports or project history; retain accounts while historical records reference them, using restrictive foreign keys for weekly-report authors. Physical Person removal requires reassigning active project ownership and unassigning active tasks/milestones; historical project contributor display names and audit records remain. No new automatic Person purge is introduced.

## Project workflow

Use the existing stable internal project UUID and statuses PLANNED, ACTIVE, PAUSED and COMPLETED. Archive remains a separate read-only condition. Public-page visibility is another independent choice.

1. Plan: title, research question/objective, department, accountable owner, team, expected outcome and optional dates. Creation produces a private workspace, not a published paper.
2. Execute: define a few milestones, assign tasks to active members, add evidence/resource links, record blockers and progress. Avoid duplicating the same narrative across tasks, updates and reports.
3. Check in weekly: each member records accomplishments, blockers and next-week plans and selects relevant projects. Supervisor review acknowledges the report or requests clarification; routine work itself is not blocked on that review.
4. Write/submit/revise: use tasks and milestones for manuscript drafting, submission and reviewer revisions. Link the existing document/repository as a resource. No new manuscript-management subsystem.
5. Publish/close: add a DOI or stable output URL when available; owner/manager records a short closing note and marks the project completed when the agreed goal is achieved. OpenAlex indexing is never a completion prerequisite. Completion with outstanding tasks should show a warning and require an explanation, not fabricate 100% progress.
6. Archive: retain the workspace read-only and expose it in a searchable archive list. Unarchive is an explicit authorized action. Completion itself allows authorized corrections until archive.

Closure accepts an optional acknowledgeOpenTasks boolean; COMPLETED with open tasks requires true and a nonempty closingNote (maximum 2,000 characters). Some projects produce code, datasets, or a negative result rather than a paper. Publication is a milestone where relevant, not a mandatory outcome for every project. Keep cancelled/stopped work documented with a closing explanation instead of forcing it to appear successfully completed; the existing PAUSED/archive combination suffices initially.

## Progress, edits and permissions

Milestones describe outcomes; tasks describe actions. Overall progress uses milestone progress with weights totalling 100 when milestones exist. A project without milestones shows no milestone progress, rather than pretending it is 0% scientifically complete. Task completion is displayed separately and does not automatically mark the project completed.

Preserve milestone IDs on edits. Update/reorder existing rows, create only new ones and explicitly remove deleted ones. Existing update references must survive ordinary edits. A BLOCKED milestone retains its last progress; blocking does not undo completed work. COMPLETE means 100%; progress percentage alone does not change overall project status.

Allocate task ordering transactionally under a per-project lock using the next available position, with the database uniqueness constraint retained. Do not use row count. Preserve completedAt when an already-done task receives a text edit; set/clear it on status transitions.

Reject inverted date ranges on both creation and editing. Milestone/task owners must be active members of that project. Use version checks for concurrent project edits and the existing stale-request protections for reviewed changes. UI controls must reflect actual access while server authorization remains authoritative.

Reuse VIEW, POST_UPDATES and MANAGE. Viewers browse; contributors maintain work; owners/managers manage the plan, team, references and closure. Admins retain intervention rights. Scope the existing review machinery to public visibility and archival decisions; apply authorized internal task, update and milestone changes directly. Remove the unused new-project approval toggle when creation is defined as a private workspace. Do not require central administrator approval for routine work. Moderators' ability to view private projects should be explicit in the UI/policy, as the current implementation grants that access.

Project API responses select only required person/account display fields. Never return password hashes, invitation token hashes, or full User records. Project lists use summaries with pagination; detail tabs load bounded task/update/history lists instead of loading all history for every project row.

## Project references to published work

Replace ProjectOutput's required catalogue-record reference with an independent ProjectOutputReference: stable local reference ID, project ID, label, normalized DOI when available, otherwise a stable HTTPS source URL. Require one syntactically valid DOI/URL and prevent duplicate references within a project. Do not fetch arbitrary URLs or require external availability when saving. Accept HTTPS URLs without credentials or control characters, normalize DOI aliases with the existing helper, and reject unsupported schemes. Use existing resource links for documents during early work.

The DOI identifies the output; the project UUID identifies the work in progress. Neither is derived from a person's OpenAlex binding. A reference may be saved before OpenAlex indexes that output and may link to work never imported into the lab catalogue. It does not create a manual ResearchItem or grant anyone authorship.

The UI can display catalogue details opportunistically when the normalized DOI matches an imported output, but the DOI/URL itself remains the authoritative reference. Changing IDs, detaching memberships, or deleting catalogue records never deletes this reference. No mandatory internal output FK and no background person-to-project attribution.

Remove paper/dataset evidence selection from weekly reports. Project updates can use ordinary DOI/URL resource links instead of a linkedOutputId FK. Research programs group projects and may use ordinary external references for published outcomes; replace direct paper/dataset catalogue dependencies with independent references there too. This makes catalogue deletion rules consistent across the application.

## Canonical published catalogue and people

One canonical PAPER/DATASET ResearchItem represents one OpenAlex work. Its OpenAlex work ID is unique; normalized DOI is a secondary unique identity when present. Conflicting identifiers are surfaced as source conflicts, not silently merged by names or similar titles.

Store source title, DOI, year, venue/type, ordered source authors, source location and retraction information. Metadata is source-readonly. Do not fetch/store abstracts in this scope. No manual entry, Add by DOI catalogue intake, manual author editing, manual contributor claims, Google Scholar sync or manual source-discovery workflow remains active.

Source authors and lab-person associations are different records:

- SourceAuthor: output ID, source author ID when provided, display name and order. Updating source order changes display only.
- PersonOutput (implemented as PersonResearchItem or equivalent): person ID, output ID, author ID that confirmed it, current flag, last-confirmed time and nullable missingSince; unique per person/output. It represents that person's independently confirmed listing plus the retained association needed for safe deletion.

Only a person's own complete author sync may create/activate their PersonOutput association. An author ID found in another person's coauthor list never assigns a local person automatically. Coauthor names without confirmed current associations remain plain source text. No name matching.

For example, P syncs W1: create W1 once and activate P-W1. Q later syncs W1: reuse W1 and activate Q-W1. Refreshing metadata never rebuilds these memberships. Changing P's ID makes P-W1 non-current; Q-W1 remains current.

## Current listing versus retention

Current profile/rank queries use current PersonOutput associations for that person's current binding. Retained non-current associations do not contribute to profile lists or paper counts.

Changing/removing an effective ID immediately makes only that person's old associations non-current. Source disappearance requires two accepted complete successful sync jobs for the same binding: the first sets missingSince, the next confirms absence and makes the association non-current. A returned work clears missingSince; a failed/partial/stale/cancelled run does not advance that state. This deliberately retains a vanished work for one extra successful sync, normally one day. Keep the association row for retention. That avoids treating 'not currently listed' as 'the person was removed from the system.'

A canonical output must not be physically deleted while any PersonOutput association, current or non-current, points to a Person still in the system. Removing a login account or marking alumni does not satisfy that condition. Actual physical Person removal removes its associations; only outputs losing their final association through that operation become eligible for canonical cleanup. Cleanup is scoped to affected IDs, not a global delete of everything with no current members. PersonResearchItem has a restrictive output foreign key and a cascading Person foreign key. Association creation and cleanup take matching per-output identity locks. Person removal locks the Person, captures all current/retained association IDs and deletes associations through the Person FK; it does not delete canonical outputs or wait for output locks. Its queued cleanup locks/rechecks candidates separately. Removal records candidate output IDs in a durable cleanup job within its transaction; cleanup locks and rechecks every candidate. Foreign-key failures retain the output and are retried/reported rather than forced through.

Public listings show valid, non-retracted outputs with at least one current association to a published lab person whose account is not in trash. Login activation is not required for an administrator-published seeded person. Alumni visibility follows the public-profile setting. With no current public members, hide the output publicly but retain it internally. Staff can browse retained records in the permanent library. Members can browse their currently associated works; hidden historical associations are not a mechanism for access to another person's private data.

Project DOI/URL references survive even when the canonical catalogue entry becomes eligible for deletion.

## Sync and operational handling

Saving/applying an ID queues a sync. Each bound person is refreshed daily. Manual 'Sync now' uses the same queue, uniqueness and provider-backoff rules. It does not bypass rate limits. Avoid overlapping jobs for the same person/binding.

Fetch all author-work pages outside a database transaction. Validate the response and exact author IDs; batch-load existing canonical records and associations. A successful fetched work must contain the current person's exact author ID before attribution can be added. Never infer missing authorship.

Apply changes atomically under the person's binding-version check and appropriate canonical-identity locks. Interrupted/failed/partial responses and superseded bindings must not detach existing memberships. Reconcile the current person's missing works only after the complete accepted result is available. A returned work with invalid metadata preserves its last-good association until it can be validated; only truly absent work IDs enter the two-success absence rule. A terminal cursor alone is insufficient: validate pagination metadata, declared result count, unique work IDs, cursor progression and the terminal page. A count mismatch, duplicate/moving page set, repeated cursor or overall deadline leaves all associations unchanged and reports an incomplete response. An empty response is accepted only with an existing exact author ID and a valid zero count. Invalid entries remain visible in the sync summary; distinguish a source warning from a request-level job failure.

Use a stable fingerprint of selected metadata to avoid rewriting unchanged canonical records. An unchanged record can still gain a newly confirmed person's association. Recalculate affected ranks and change the public-cache revision in the same transaction only when membership, usable output status or metrics change. Metadata-only visible changes also change that revision. Queue the external revalidation webhook job in that transaction. All affected rank/metric writes occur in the owning transaction, with no nested independent commit. No rank write or required cache revision depends on a post-commit callback. Source-sync settled listeners must not also invalidate unchanged work. Start with complete daily author fetches; do not add a shared work-cache or incremental protocol until measured traffic warrants it.

Use OpenAlex's author citation count for citations; label it as the author's total OpenAlex count rather than a sum of lab-linked works. No count from Scholar and no count duplicated across coauthors.

Provider quota/network failures retain last-good output data, fail/defer the worker visibly and schedule a bounded retry. Retractions are flagged and excluded publicly while source metadata remains inspectable internally. Unsupported types and incomplete records are skipped/flagged in a source-health summary. Admins can correct a person's ID or retry after backoff; they do not edit source authors or approve guessed relationships. No separate papers/datasets review queue.

Admin UI continues to manage the encrypted provider key and distinguish keyed versus anonymous usage telemetry. Unavailable/unknown usage is shown as unknown, never as zero consumption or unlimited budget.

## Reliability contracts

Use the existing PostgreSQL Job table. Add a per-claim leaseToken and leaseExpiresAt, and include the token in JobContext. Initial bounds are a 90-second lease, 15-second heartbeat and 30-second recovery sweep. These are starting operating limits, not evidence of measured capacity. Recover expired leases periodically, including jobs whose process restarted before expiry. Heartbeats, failure transitions and completion are conditional on the current token. A stale worker can neither acknowledge a reclaimed job nor commit research effects.

An OpenAlex attempt fetches/validates outside the transaction, then performs every accepted output/association/profile/rank/cache change in one database transaction. SQL may use several batched statements, but no output record is committed separately. Validate the lease at entry without holding the Job row lock for the transaction. Keep heartbeat and direct cancellation updates writable. As the final database operation, conditionally mark the Job SUCCEEDED only when its lease token is current, lease/deadline valid and cancelRequestedAt is null; zero updated rows throws and rolls back every import write. This final operation takes the Job row lock only until COMMIT. The transaction has a 60-second timeout. A crash before commit rolls back; a crash after commit leaves a terminal job with all required state present. External side effects such as SMTP are still at-least-once unless the existing provider supports an idempotency key; this design does not promise exactly-once email.

Cancel is a direct request against the existing job, never a separate queued cancellation job. It atomically sets cancelRequestedAt while the job is RUNNING and immediately aborts the local owner signal; a remote owner observes the flag through its control poll. Check cancellation between batches and at the final conditional success write, throwing to roll back the whole transaction. A running SQL statement may finish before rollback, but its writes remain uncommitted and invisible. The UI says cancellation requested until rollback is confirmed, then CANCELLED. If cancellation wins the final Job-row race, rollback is mandatory; if success wins and commits first, cancellation returns already applied. A transaction cannot undo committed work. Cancel handlers must check binding version and cannot overwrite a completed/newer profile state. Control polling must read the Job without taking project/output/Person locks.

For canonical writes and cleanup, acquire transaction-scoped advisory locks keyed by normalized OpenAlex work IDs and DOI identities in sorted key order; lock affected Person/OpenAlexProfile rows afterward in sorted ID order, then take the final Job completion lock last. Build/recheck the affected set before mutations. Identical work/DOI identities serialize, independent imports can commit concurrently; unique constraints remain the final safeguard. If rechecking discovers an additional identity outside the sorted lock set, retry the transaction with the expanded set instead of taking it out of order. Binding edits and physical Person removal use Person/binding locks only and never acquire output locks while holding them. Rank-policy recalculation locks affected people in sorted order and does not wait for output identity locks. Do not hold the old global RESEARCH_IDENTITY_LOCK across a whole author import. Capture one monotonically increasing PostgreSQL OpenAlex observation sequence value before fetching each attempt. Store observationVersion on each accepted source snapshot; omit this BigInt marker from API response DTOs, including transitional endpoints, rather than spreading Prisma snapshots into JSON. An older observation cannot overwrite newer metadata, including retraction state, but may establish its own exact-author association if the current accepted output is usable. Observation ordering governs shared metadata; it does not replace each person's independent attribution evidence. Older metadata observations never regress freshness markers. Rejected/stale attempts for a person's binding cannot change that person's association or missingSince. This orders our observations; it does not guarantee that OpenAlex's upstream index is instantly consistent.

Dispatch independent eligible jobs concurrently from the existing Job table through a configurable bounded pool. Initial JOB_CONCURRENCY is 8 per process (validated range 1–32); this is a starting budget, not a measured optimal value. No single-OpenAlex lane and no fixed one-job-at-a-time executor. Claim each job atomically across processes and allow no overlapping current jobs for the same person/binding. Admit commit transactions only within the configured PostgreSQL connection budget, reserving capacity for HTTP requests and control polling; obtain that capacity before taking transaction locks. Provider pauses/rate responses constrain dispatch without holding a database transaction while waiting. Prioritize mail/push and interactive binding changes over daily syncs, with aging so older routine work still advances. Every free eligible worker slot is used within these budgets. Measure and adjust the budget to actual DB/provider/memory capacity; unlimited dispatch would undermine recovery and request latency.

Cap a source attempt at five minutes including fetching, resource waits and commit, retain the existing 20-second HTTP-request timeout and 60-second commit bound. Initially cap at 50 pages/5,000 unique works. Exceeded budgets are incomplete and leave all previous associations intact. Larger profiles need measured budget adjustment, not partial commits.

A quota response records a shared provider pause in SiteSetting, scoped to the current credential fingerprint (or anonymous identity); never store the raw key as the identity. Check this pause before every page and manual retry. Pause until the provider retry time, using one hour if none is supplied; transient request errors retain bounded exponential backoff. Quota expiry and scheduled run times include deterministic per-person jitter of at most five minutes to avoid a retry burst. A new validated credential changes identity and does not inherit a previous credential's pause. Do not guess remaining budget from local counters when authoritative telemetry is unavailable.

Durable cache invalidation advances the existing shared revision inside the data transaction and inserts a unique REVALIDATE_PUBLIC_CACHE job keyed by the originating change/job. Webhook delivery retries without reversing that revision. Duplicate delivery is harmless. Existing non-research callers can retain their current API while research/profile binding changes use the transactional path.

Store OpenAlexProfile.boundAt only when an effective ID changes; retries/metadata refreshes do not alter it. Health targets start from boundAt, not account creation or pending review. The five-minute interactive start target is monitored under available capacity; bulk initial seeding is excluded and overload reports queue age instead of promising a deadline. Initial healthy-provider targets: new effective bindings begin processing within five minutes; current bound profiles have an accepted sync within 48 hours; cache webhook delivery occurs within five minutes when the frontend is reachable. Targets do not justify dropping data during outages. Expose last successful sync, pending count/oldest age, expired leases/recoveries, provider pause, oldest failed follow-up and source conflict counts in the existing admin UI. Mark a bound profile stale after 48 hours without success, or never-synced after 48 hours from binding. Show unknown provider usage explicitly. A sustained provider outage keeps last-good data with visible stale/error status.

Identifier conflicts, unsupported work types and invalid individual records do not fail unrelated valid records or lead to name/title merging. Record per-item warnings and a succeeded-with-warnings display derived from the sync summary; quota, transport, pagination and transaction failures fail/defer the whole job. A returned valid work ID preserves its last-good association and clears missingSince even if other metadata is invalid; it cannot create new attribution without valid exact-author evidence. An unidentifiable work row makes the response incomplete. Do not introduce a manual metadata editor to resolve provider conflicts.

## Migration and recovery contracts

Separate additive schema/backfill, read/write switch and destructive cleanup. Update the implementation plan alongside this design; no old checklist may silently override these contracts. Stop the old local backend before changing schemas or retiring handlers, and restart only with an explicitly guarded local DATABASE_URL. Production rollout/rollback needs its own authorization and target preflight; this document is not permission to deploy.

A migration preflight verifies host 127.0.0.1, port 5433, database amirl for the previously authorized local cleanup, plus database identity and expected schema/data counts. Do not fall back to backend/.env. Integration/recovery rehearsals use separately created local fixture databases on that container, never the configured hosted URL. The production-data authorization boundary remains separate from test-fixture creation.

Rehearse conversion with populated fixtures: project-output links, program-to-project and program-to-output links, linked project updates, weekly reports, exact verified author associations and legacy records lacking identifiers. Prefer normalized DOI, then a validated canonical/legacy HTTPS URL, then the OpenAlex work URL when available. A reference with no usable identifier stops contract/removal; preserve the old row and report its ID. Never drop it silently or bind by title. Program-to-project links survive: convert/remove only PAPER/DATASET items from ResearchProgramItem, not the project-grouping rows or the whole table. Before removing report-output relations, append any existing output reference as a labelled plain-text source URL block to that report's accomplishments, preserving the original text and identifying each converted output by its stable UUID so reruns cannot append it twice; the report remains even though new reports have no output selector. Missing reference identifiers block that conversion too.

Make conversion rerunnable through stable old-reference IDs and unique target keys. Simulate interruption between phases and rerun; verify unchanged person/account/project/report counts and semantic reference equality, rather than total row counts alone. The local one-time legacy-output clearing is a separate guarded operation after conversion and validation; preserve all 115 people/accounts and the existing project. If current counts differ, stop to inspect rather than assuming a seed rebuild is equivalent recovery. Retire queued source-discovery/Scholar jobs and reject retries for unregistered types; retain historical runs visibly labelled retired.

Database recovery must use the same externally retained ENCRYPTION_KEY for encrypted SiteSetting credentials. Do not generate a new key on restart/restore and do not place its plaintext in database backups, logs or test artifacts. Reuse the existing local backup/restore tools for an isolated fixture restore containing dummy encrypted provider settings; prove matching-key decryption succeeds, wrong/missing-key behavior is explicit, and restored independent references/associations retain meaning. No real provider secrets are needed for these automated tests. Existing production backups/key custody are a separate operational responsibility; no new hosted backup is implied.

## User-facing pages

- People: public profile, current OpenAlex outputs and ordinary profile links. Account readiness is shown only where relevant to administration.
- My profile / admin person editor: dedicated OpenAlex ID, last sync and actionable failure/status text.
- Projects: searchable paginated active/completed/archive views and a focused workspace for plan, tasks, updates, team and independent references.
- Weekly reports: accomplishments/blockers/next plan and project context. No published-output selector.
- Papers & datasets: permanent paginated source-readonly library, scoped for members; staff can also inspect retained/flagged records. No manual Create/Edit/Review/Claim author actions.
- Workers/admin: bounded paginated runs, all active job types, visible failures/retries and clearly labelled retired historical jobs.

Keep shared form fields, reserved message space, responsive controls, existing skeletons and dirty-form safeguards. Show real capabilities/status rather than buttons that fail after clicking.

## Migration and evidence required

Preserve unrelated worker/mail/settings work. This design alone does not authorize another destructive operation or hosted migration. The previous authorization for a guarded local legacy-paper cleanup remains limited to the verified local DB.

Before removing old relation tables, identify links in the target DB; translate any project/program output links to DOI/URL references and preserve project/weekly-report records. Local inspection currently found zero ProjectOutput, WeeklyReportOutput, linked ProjectUpdate outputs and ResearchProgramItem links. This does not establish hosted counts.

Backfill stable person-output associations only from exact verified source-author relationships, never from names or manual proposals. Remove legacy manual output seeding, retaining real people/accounts, known author IDs, universities and lab projects. Preserve old manual records only if required by a separately approved target migration; do not silently mix them into the author-sync-only catalogue.

Acceptance checks must prove: shared coauthors create one output; no assignment from another person's scan; source-author reordering does not change memberships; ID change detaches only that person's current listing; complete versus failed reconciliation; no deletion until all associated Persons are physically removed; independent DOI references survive catalogue deletion; blocked milestones preserve progress and stable references; delete-then-create/concurrent tasks succeed; API responses contain no credential material; archived work remains accessible; source-only routes and UI are consistent.

Current evidence: read-only code review found credential overfetching, unsafe task sort allocation, destructive milestone replacement, blocked-progress reset, inconsistent weight validation and missing archive browsing. Three related service test suites passed 18 tests, but those checks do not cover all these defects. Browser/live provider/hosted lifecycle verification is not evidence supplied by this design.

## SQA release gates

The execution plan owns concrete tests for all of these contracts. Unit fixtures pin exact IDs, state transitions, secret-field allowlists and error messages. Local PostgreSQL integration tests prove constraints, transactions, two-worker leases, stale observations, deletion races, migration interruption and restart recovery. Browser tests prove permissions/copy, archive browsing, DOI references, current versus pending bindings, pagination, responsive controls, loading/outage states and source-readonly details.

Run process-kill tests before commit, after commit and during lease recovery; verify outputs, associations, ranks, cache revision and job terminal state together. Verify that a successful job with warnings is distinguishable from a failed quota job. Cover unchanged metadata, invalid-but-present work, anomalous zero/count mismatch and two accepted absence confirmations for one binding. Cover denied member/viewer actions and nested credential leakage across list/detail/task responses. Scope every database-writing test explicitly to local fixture databases, clean up fixtures, and capture counts/results without keys or password hashes. Do not claim hosted, live-provider, restore or browser acceptance from mocked/unit tests.

No implementation, commit, push, deployment, hosted migration or new production backup is performed by this documentation revision.
