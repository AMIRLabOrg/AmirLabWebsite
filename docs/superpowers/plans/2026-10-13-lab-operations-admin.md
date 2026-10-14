# Lab Operations Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make profile approval, external-service usage, email configuration, and background-job monitoring usable and truthful for lab administrators.

**Architecture:** Reuse `Person.isPublished`, admin-only settings endpoints, encrypted `SiteSetting` credentials, the existing mail service, and paginated Jobs API. Extend those paths with minimal schema changes; do not add a parallel integration/job abstraction.

**Tech Stack:** NestJS, Prisma/PostgreSQL, Next.js/React, Jest, existing UI controls.

**Spec:** `docs/superpowers/specs/2026-10-13-lab-operations-admin.md`

## Global Constraints

- Never return provider secrets to the browser or include them in audit records/job payloads.
- Keep existing member moderation and published public data stable while drafts await review.
- Preserve current queued and immediate email call sites.
- Do not retry OpenAlex quota failures before `nextAttemptAt`.
- Do not commit, push, deploy, or mutate hosted databases.

## Review Focus

- Profile creation must not accidentally make pending member submissions public; cover admin create, member first submit, edit of a published member profile, approval, and rejection.
- Integration settings must not replace working credentials after invalid provider responses; cover encryption and secret-free output.
- OpenAlex anonymous allowance is shared and stale; label source/freshness and avoid presenting it as account-owned exact usage.
- Resend usage API may be unavailable or reject credentials; show unavailable state without hiding mail delivery status.
- Large queues and unknown historical job types must remain navigable; cover page changes, filter resets, empty results, and unknown types.

---

### Task 1: Profile publication and admin state

**Files:** `backend/src/users/users.service.ts`, `backend/src/users/users.service.spec.ts`, `backend/src/profiles/profiles.service.spec.ts`, and the admin account list UI/tests.

- [ ] Add failing service tests for admin-created profiles publishing immediately and account setup remaining pending.
- [ ] Run the focused tests and confirm the new publication assertion fails.
- [ ] Set publication only on admin account creation; expose the current publication flag in account list/detail responses and display it separately from account status.
- [ ] Test initial member submission awaiting approval and published member edits/rejections retaining the previous public version.
- [ ] Run focused profile/user tests.

### Task 2: OpenAlex usage reporting

**Files:** `backend/src/research/openalex-client.ts`, `backend/src/settings/settings.service.ts`, settings controller/DTO, OpenAlex settings UI and tests.

- [ ] Add failing tests for key-scoped quota refresh and anonymous last-observed quota metadata.
- [ ] Capture rate-limit headers from normal OpenAlex responses; add an admin read endpoint that refreshes authenticated `/rate-limit` when a key exists and otherwise returns the last anonymous observation with a freshness label.
- [ ] Persist only quota metadata, never the API key or request URL containing it.
- [ ] Display remaining/limit/reset, key versus shared anonymous source, and stale/unavailable states.
- [ ] Verify the usage endpoint does not replace or leak saved keys on failure.

### Task 3: Admin email configuration and usage

**Files:** `backend/src/mail/mail.service.ts`, `backend/src/mail/mail.module.ts`, `backend/src/settings/*`, `backend/src/config/environment.ts`, admin settings UI, and focused tests.

- [ ] Add failing tests for encrypted SMTP/Resend configuration, SMTP connection validation, Resend token validation/usage, and failed replacement preserving the current provider.
- [ ] Store the selected provider and non-secret options in `SiteSetting`; encrypt credentials with existing `ENCRYPTION_KEY`. Keep env SMTP as fallback only when no database setting exists.
- [ ] Configure subsequent queued and immediate sends from DB settings without persisting credentials in jobs. Support SMTP and Resend only.
- [ ] Provide provider-specific conditional fields, test-connection/test-email action, secret replacement/removal handling, and secret-free saved status.
- [ ] Show Resend quota from its account usage API; show SMTP app-side job delivery counts clearly labeled as not vendor quota.
- [ ] Verify auth flows that call `sendNow` remain functional and missing configuration fails visibly rather than marking skipped delivery successful.

### Task 4: Worker queue usability and truthful OpenAlex outcomes

**Files:** `backend/src/jobs/jobs.service.ts`, jobs DTO/controller/specs, `backend/src/research/openalex.service.ts` and specs, `frontend/src/components/workers-monitor.tsx`, and worker UI tests.

- [ ] Add failing tests for type options including `All`/historic types and page navigation/filter page reset; cover unknown types.
- [ ] Add server-returned known types by combining registered handlers with stored job type history; keep paged backend query semantics.
- [ ] Add UI pagination and collapsible job-type groups with summary counts and paginated run details.
- [ ] Change OpenAlex queue outcome reporting so a sync deferred by profile-level quota backoff is not presented as imported success; retain retry timing and avoid generic immediate retry.
- [ ] Keep sensitive job payload fields out of detail rows; add test for only safe summary detail being returned.
- [ ] Run jobs/OpenAlex/UI tests and verify empty status/type filters.

### Task 5: Whole-change review and verification

- [ ] Review existing uncommitted worker changes together with this diff; preserve unrelated user work and repair important issues found.
- [ ] Run backend and frontend test, typecheck, lint, and production build commands supported by the repository.
- [ ] Re-read the spec and verify each acceptance check; report any provider-specific test that needs real credentials as environment-limited.
