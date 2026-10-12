# Backup Provider Presets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add conditional provider presets and working local, S3-compatible, and SFTP backup destinations while retaining tested local recovery.

**Architecture:** The existing BackupsService remains the capture/schedule/restore owner. Storage adapters handle destination-specific file transfers; one stored active configuration owns encrypted credentials. Reuse the installed AWS SDK and OpenSSH tools; add no provider dependency.

**Tech Stack:** NestJS, Prisma SiteSetting, Node crypto/fs/streams, AWS SDK v3, OpenSSH sftp, React house controls, Jest/Vitest.

**Spec:** [Backup provider presets](../specs/2026-10-12-backup-provider-presets.md)

## Global Constraints

- No commit, push, deployment, or hosted database writes.
- Database/upload sources remain loopback/local and development/test only.
- Existing local configuration and recovery command remain compatible.
- Remote credentials are encrypted at rest and omitted from status responses.
- SFTP requires a trusted host key; plain FTP is excluded.
- No live S3 result is claimed without an actual account.

## Review Focus

- Blank secrets after reload must preserve credentials only for the matching provider/authentication mode.
- A remote manifest containing traversal paths must fail before downloads or restore writes.
- Partial uploads must never become complete indexed snapshots.
- Unchecked remote listings must not cause a backup every scheduler tick or falsely report verification.
- A failed recovery must retain a preexisting truncated interruption marker and the prior uploads.

### Task 1: Configuration and credential storage

**Files:** modify `backend/src/backups/backups.dto.ts`, create `backup-storage.ts`, `backup-credentials.ts` and matching specs; update `backups.service.spec.ts` fixtures.

**Interfaces:** Export `BackupProvider = 'local' | 's3' | 'sftp'`, provider configuration/secret types, `Snapshot` (existing fields), and `BackupStorage` with `list(): Promise<Snapshot[]>`, `save(snapshot: Snapshot, directory: string): Promise<void>`, `load(id: string, directory: string): Promise<Snapshot>`, optional `close(): void`. Credential helper encrypts/decrypts one secret object using the protected local key.

- [ ] Write and run failing tests for legacy local defaults, invalid provider fields, credential encryption/redaction and blank-secret preservation.
- [ ] Extend the DTO with conditional fields; implement key handling and canonical public/stored configuration shapes.
- [ ] Run focused tests and backend type check.

### Task 2: Storage destinations

**Files:** `local-backup-storage.ts`, `s3-backup-storage.ts`, `sftp-backup-storage.ts`, associated specs; shared path/manifest validation in `backup-storage.ts`.

**Interfaces:** Implement the Task 1 `BackupStorage` contract using provider config plus decrypted secrets.

- [ ] Test and reject absolute/traversal/control-character paths and malformed UUID/hash manifests before I/O.
- [ ] Implement local atomic publication in the existing directory layout; test partial cleanup and load compatibility.
- [ ] Test S3 paginated listing and streamed get/put using SDK boundary doubles; implement manifest-last publication and sanitized errors.
- [ ] Test SFTP batch quoting, host-key pinning, key/password authentication and failure cleanup; implement transfers with installed OpenSSH.
- [ ] Run provider specs; report that SDK/command tests are not live-account/protocol proof.

### Task 3: Wire capture, status, scheduling and recovery

**Files:** `backups.service.ts`, `backups.service.spec.ts`, `scripts/restore-local-backup.ts`, `scripts/verify-local-backups.ts`.

- [ ] Add failing tests for unchecked remote list values and scheduling from completed non-safety manifests.
- [ ] Stage snapshots locally, publish through selected storage, and load selected archives before existing verification/restore phases.
- [ ] Return redacted settings and `verified: boolean | null`; retain a visible storage failure state so an admin can repair configuration.
- [ ] Add explicit remote storage-config-file recovery while preserving the old local CLI arguments and production refusal.
- [ ] Rerun local integrity/failure/empty-schema restore tests; keep legacy local settings compatible.

### Task 4: Preset dropdown and conditional admin fields

**Files:** `frontend/src/components/backup-settings.tsx`, `backup-settings.test.tsx`, `README.md`.

- [ ] Write failing component tests for all three preset field sets and selected-provider payloads.
- [ ] Use SelectControl, FormField, InputControl, PasswordControl and CheckboxControl; default a changed provider's schedule off and clear displayed secret values after save.
- [ ] Keep remote integrity copy honest, label safety snapshots, and preserve successful restore acknowledgement if authentication tables change.
- [ ] Document setup, SSH host keys, encryption-key retention and remote recovery configuration.
- [ ] Verify fields, local save/manual/schedule behavior and retained loading/error paths in Brave.

### Task 5: Final verification and review

- [ ] Run full backend/frontend suites, type checks, lint, architecture checks and backend build.
- [ ] Request one fresh review of credential handling, transfer paths and restore ordering; resolve concrete findings.
- [ ] Report local verification separately from untested live S3/SFTP delivery. Do not commit, push or deploy.

## Local verification results

- Inline implementation approved; changes remain uncommitted, with no push or deployment.
- Full backend: 257 tests / 42 suites passed after review fixes.
- Full frontend: 62 tests / 18 files passed with the runner timeout raised to 15 seconds (assertions unchanged; the existing research-review-queue test exceeded the default 5 seconds under load).
- Backend build, both type checks, lint and architecture contracts passed. Frontend lint retains two preexisting image warnings.
- Actual local verification: 20 checks passed against only `amirl_backup_verification` at loopback port 5433; schema cleared, application failure confirmed, records and upload bytes restored exactly.
- Final review findings fixed with failing then passing tests: numeric manifest dates, the first upload rename preserving a prior raw interruption marker, and denied SFTP manifest reads reporting storage failure.
- S3 fields observed in Brave. Live S3/SFTP delivery remains untested without an account/endpoint.
- Browser review initially hit its usage limit; after the stated reset time, access resumed normally. SFTP private-key/password field switching and local manual capture passed in the admin browser.
- Follow-up button layout: natural action width, left content shrinks first, existing narrow-screen stacking retained; five account-settings tests, type check, lint and UI contracts passed. Brave desktop showed a single-line 151px button; at 390px viewport its panel header stacked vertically without overflow. Viewport restored.

Implementation rulings: retained the authorized checkout and uncommitted changes; reused existing PasswordField rather than creating PasswordControl; updated the obsolete provider documentation within the approved documentation scope. No runtime tradeoff from these choices. No deferred review minors remain.
