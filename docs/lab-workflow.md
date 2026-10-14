# Lab workflow

New accounts and their initial profiles are accepted and published immediately, including the canonical seed. Creation produces no profile review request. PENDING_SETUP means password setup is still pending; it is independent of profile publication. Later member profile edits use the existing review policy. No Created/Edited state or new audit action is required.

People have one dedicated OpenAlex author ID. Administrators apply it directly; member changes use profile review. Once effective, the binding queues an author sync and runs again daily. A pending request does not change the effective binding.

Published papers and datasets enter through author sync only. Source metadata is read-only. Each person receives only works returned for their own exact author ID; names never identify accounts. Shared works have one catalogue record and independent person associations. Changing an ID replaces that person's current listing. Removing a person does not remove a shared output while another person association remains.

Projects track work before publication: team, objectives, milestones, tasks, updates and weekly reports. Internal edits apply directly. Public visibility and archive decisions follow the configured review policy. Completion requires a closing note and acknowledgement of remaining open tasks. Published results are independent DOI/HTTPS references, so they survive catalogue changes. Weekly reports describe project progress and do not depend on a published output record.

The paper/dataset manual entry, author matching and publication-review routes are retired. Profile changes, project publication/archive decisions, weekly reports, applications and document approval still have their own review flows. Source warnings are diagnostics, not editable publication submissions. The library views are Published outputs (published records with current person associations), Link history (published records with inactive person associations), and Source issues (retractions or failed source checks). Newly imported retractions belong to Source issues, even on a fresh database; they do not constitute link history.

## Worker types

| Type | Purpose and trigger |
| --- | --- |
| OpenAlex author sync | Imports one effective author binding; triggered by binding changes, daily scheduling and administrator retry. |
| Cleanup research outputs | Removes eligible orphan outputs after a person is removed, while preserving shared outputs. |
| Recalculate ranks | Updates metrics and appointed-rank policy results after source or policy changes. |
| Revalidate public cache | Delivers committed public-cache revisions to the frontend. |
| Parse application | Extracts and assesses a newly uploaded application resume. |
| Send rejection email | Delivers a recorded application rejection decision. |
| Send email | Delivers queued account/invite and other transactional mail using the configured provider. |
| Send issued document | Delivers an approved issued document. |
| Web push | Delivers browser notifications from the server to registered subscriptions. |
| Research source discovery (retired) | Historical manual publication source-check jobs; cannot be started or retried. |
| Google Scholar sync (retired) | Historical Scholar jobs; OpenAlex is the active research provider. |

Deleted-account purging is hourly maintenance, not a separate queued job: accounts trashed for 30 days are eligible, but ownership constraints retain accounts that still own records. It does not remove the Person identity.

Workers expose all registered types and labelled historical types, with pagination and expandable groups. Cancellation aborts a running job directly. Catalogue changes commit in one transaction; cancellation or lease loss before commit rolls everything back. A completed commit is the final boundary and cannot be undone by cancellation.

## Provider settings

Administrators configure SMTP or Resend and OpenAlex in the application. Provider secrets are encrypted in the database using ENCRYPTION_KEY from the environment; passwords remain one-way hashes. New credentials are validated before replacing saved configuration.

OpenAlex displays provider-reported budget for keyed and anonymous requests. Unknown allowance stays unknown. A shared rate-limit pause prevents retry storms. A different valid key has its own pause.

SMTP displays this application's daily delivery successes and failures; SMTP has no standard account-quota query. Resend displays its daily account usage via the official Usage API, which requires a full-access API key. Unavailable quota is not reported as zero.

## Local reset

The current local database is a fresh seed, not a legacy conversion. It contains 114 real members, one administrator, 58 known author bindings, academic partners and lab projects. No manual papers or author-match records are seeded. User logins, prior settings and sessions are cleared by a full reset; configure providers in the administrator UI again.

Hosted reset/deployment is a separate operation and was not performed for this implementation.

## Search and loading

Page and record searches use `ToolbarSearchField`: type a query and press Enter. Its clear button clears and applies the search immediately; publication “Reset filters” appears only for nondefault year, category or sort. Change `SEARCH_DEBOUNCE_MS` in `frontend/src/lib/search-policy.ts` from `null` to a delay to enable trailing debounce globally. Dropdown option filtering remains immediate.

Controls use skeletons only before their initial data arrives. Later refreshes preserve input values, selections, counts, pagination and focus; failed refreshes retain known results with an error. Result rows may show placeholders while updating. `ButtonControl.busy` prevents duplicate actions without hiding their labels. Intentional field disabling during form submission remains distinct from data-only refreshes.

## Hosted upgrade

The reviewed `backend/deploy/2026-10-14-openalex-library.sql` upgrades the existing schema without reseeding live accounts or settings. It guards the observed counts and empty legacy references, retires Scholar metrics, and queues current author bindings for full sync. Apply only with the old backend stopped, then verify schema equivalence before deploying. Fresh author associations temporarily leave the public catalogue empty until sync completes. Fly releases run schema checks without seeding files into an unmounted release container.
