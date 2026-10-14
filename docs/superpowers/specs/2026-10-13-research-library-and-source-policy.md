# OpenAlex research library and independent attribution

Status: superseded by [the SRE/SQA-revised lab design](2026-10-13-lab-projects-people-and-outputs-design.md). Execute only the implementation plan linked to that design. The notes below are historical decisions, not an independent migration contract.

## Approved decisions

Papers and datasets enter through each person's OpenAlex author sync only. Remove manual entry, editable source metadata, manual author claims, name matching, source-discovery verification, and the paper/dataset review queue. Projects remain separate lab workspaces.

Store one canonical ResearchItem per OpenAlex work, with independent person–item memberships. Only that person's own author sync may confirm their membership by exact OpenAlex author ID. A work's coauthor list alone must never assign other local people. Source authors are read-only display metadata; author ordering must not control membership.

Members and administrators can change a person's OpenAlex author ID through the existing profile settings. Changing or removing the ID detaches that person's previous memberships and schedules the new binding, if present. Version checks prevent an old in-flight sync from restoring obsolete memberships.

## Retention

A binding change or a work disappearing from an author response never deletes the canonical output, report links, or project/program references. Other people's memberships remain intact. Public person listings use current confirmed memberships, rather than historical ownership or author names.

An output must not be deleted while any associated person remains in the system. Losing its last current membership makes it unlisted; it is not an automatic deletion trigger. Historical references remain usable. Permanent removal after all associated people are removed is eligibility, not a requirement for automatic deletion.

The previously authorized local legacy-paper cleanup is a one-time migration exception. Preserve all 115 people/accounts and project workspaces. Never target Supabase for this migration.

## Sync and library

Fetch every page before reconciling current memberships. Failed, partial, cancelled, or superseded fetches leave existing memberships unchanged. Each completed sync only reconciles its own person.

Batch existing-record lookups and skip unchanged metadata writes using a stable source fingerprint. Still add a missing person's confirmed membership when metadata is unchanged. Recalculate affected ranks and invalidate public caches only when relevant data changes. OpenAlex is the sole citation provider.

Provide a permanent paginated, searchable papers/datasets library with source-readonly details. Members see their own confirmed works; staff can browse retained records. Remove manual create/edit/review actions and retire their worker handlers. Historical jobs may remain visibly labelled retired.

## Acceptance

- Two independently synced coauthors share one canonical output.
- Syncing one person never grants or removes another person's membership.
- Changing author order or removing a binding preserves the canonical output and historical references.
- Removing the last binding does not physically delete the output.
- No matching by name or manual paper/dataset entry remains active.
- A repeated unchanged sync avoids rewriting canonical metadata.
- Local migration preserves people/accounts/projects and is guarded against hosted targets.
- No commit, push, deploy, or hosted-data mutation without separate authorization.
