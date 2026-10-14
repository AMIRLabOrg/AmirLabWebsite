# Lab Operations: Publication, Integrations, and Workers

## Goal

Give lab administrators an accurate, low-friction way to publish profiles, monitor external-service budgets and email delivery, and inspect background work without losing operational failures in the UI.

## Profile lifecycle

- Creating a person through the admin account flow publishes the public profile immediately, while the account remains `PENDING_SETUP` until its owner activates it.
- A member's first profile remains unpublished until a reviewer approves it. Editing an already published profile creates a draft; public pages continue showing the last approved profile until approval. Rejection leaves that public version intact.
- Admin direct edits take effect immediately. OpenAlex syncing depends on a committed OpenAlex profile binding, not account activation or public publication.
- Account state and profile publication state remain separate fields and are shown separately in admin account listings.

## Integrations and usage

- OpenAlex is the sole citation provider for earned ranks and public people ordering. Store its author citation total on `OpenAlexProfile` during the existing daily import, clear it on ID replacement/removal, and preserve it when a refresh fails. Profiles without an OpenAlex ID use paper-only ranking; a bound profile awaiting its first valid total does not bypass citation thresholds. Remove Scholar scraping/scheduling and retire its pending jobs; ordinary Scholar profile links remain available.
- Keep the existing OpenAlex key-setting workflow and encrypted `SiteSetting` storage. Add a quota view showing the last observed limit, remaining budget, and reset time, clearly identifying whether the measurement is key-scoped or a shared anonymous-IP observation and when it was observed.
- Add admin-managed email provider settings for SMTP and Resend, with provider-specific fields and validation before replacing a working configuration. Store credentials encrypted using the existing `ENCRYPTION_KEY`; never return secrets to the browser. Existing SMTP environment configuration remains a boot-time fallback when no database configuration exists.
- Show Resend provider quota from its account usage endpoint. For generic SMTP, show only application-side send-job counts and delivery failures; never imply those counts are the SMTP vendor's quota.
- Preserve current mail queue consumers and one-time immediate email behavior. Configuration edits affect subsequent sends; queued jobs never contain provider credentials.

## Worker monitor

- Keep the existing job table and backend paging. Add usable previous/next pagination to the UI and reset to page one when filters change.
- Add an explicit `All` job-type option and allow every registered, currently stored, or historical job type to be filtered. Synchronous manual source verification remains outside the job list; queued research source discovery remains visible.
- Group runs by job type. Each group can expand to show its runs and status/timing/safe error detail. Page the run list so large history does not overflow the page.
- Make OpenAlex quota/backoff failures visible as deferred/failed sync work, not green successful imports. Respect `OpenAlexProfile.nextAttemptAt`; do not create a fast retry loop for daily quota exhaustion.

## Security and compatibility

- Admin endpoints remain role-protected. Secret updates validate before replacing current values and audit only provider/configured state, never credentials.
- Existing data is retained. No schema migration should delete research outputs or account records.
- Generic SMTP cannot expose vendor quota unless that vendor has a dedicated API adapter; this release supports SMTP and Resend only.

## Acceptance checks

- Tests prove admin-created profile publication and member first-publication/edit moderation behavior.
- Tests prove encrypted email credentials, secret-safe status responses, failed validation preserving saved settings, and provider test/usage behavior.
- Tests prove queue paging, complete type filtering, grouped display, and OpenAlex backoff visibility.
- Run backend tests/typecheck/lint and frontend tests/typecheck/lint/build appropriate to changed paths; inspect the final diff and preserve all pre-existing uncommitted work.
