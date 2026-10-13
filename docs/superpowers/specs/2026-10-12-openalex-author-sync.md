# OpenAlex from profile links

Updated to the user's 2026-10-12 instructions: use the existing profile link instead of a separate binding UI; changing/removing the source must lose previous outputs and use the new author's data.

- Use a dedicated Research sync / OpenAlex ID field backed by the existing typed profile link. Accept an OpenAlex author URL/ID and normalize its URL. Reuse member profile editing, admin editing and the existing save/approval policy. No preview/confirmation panel or separate binding endpoints.
- The published profile link is the source of truth. Applying a changed/removed ID immediately clears that person's old paper/dataset contributor associations, contributor decisions and publication sections. Delete old outputs only when no other local person/submitter owns them; preserve shared records, internal projects and unrelated profile data.
- A new ID queues its author works. Removing the link pauses sync. Revisions invalidate queued/in-flight work. A profile save and source replacement are one transaction; stale profile reviews roll back all source changes.
- Read all fixed-host OpenAlex cursor pages outside database transactions. Bound requests and response sizes; optional server-only API key. Partial failures, 404 and 429 never apply partial results; retry with backoff.
- Reuse canonical ResearchItem/Paper/Dataset, source snapshots, author order, existing contributor decisions, JobsService, rankings and cache invalidation. One unique work ID on ResearchItem supports papers and datasets. Deduplicate work ID/normalized DOI. Bind only the currently confirmed author ID, never names.
- Import articles, reviews, conference papers, book chapters and datasets. Retractions need review; unsupported types and identity/duplicate conflicts appear in the stored skipped summary. Unchanged-ID refreshes retain curated fields and manual contributor decisions. Missing upstream records are recorded and retained until explicit source replacement/removal.
- Check due sources hourly, schedule successful sources every 24 hours. Profile application queues the new source immediately. No separate manual OpenAlex UI is needed.
- Work remains on feat/openalex-author-sync. Use only local amirl at 127.0.0.1:5433. Preserve the legacy backup and original credentials; original 201 local papers were cleared with the authorized guarded reset. Do not deploy, commit or push the migration without a new request.

Verification: profile-link normalization/duplicates, normal profile publish/review hooks, immediate replacement/removal, stale revisions, shared outputs, datasets, idempotence, DOI collisions, curated fields, missing upstream, backoff, full suites/contracts/builds, local browser acceptance and one final review.
