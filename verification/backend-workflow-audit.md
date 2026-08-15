# Backend workflow audit

The Prisma schema is unchanged. The behavioral changes use the existing schema and review records.

- Imported people create MEMBER/PENDING_SETUP accounts and identity-anchor `Person` rows, but the scraped public profile data/portrait is staged in `ProfileEditRequest` with `NEEDS_REVIEW`; `Person.isPublished` starts false.
- Imported papers are created as `NEEDS_REVIEW`.
- Known imported contributor identities create `PROPOSED` contributor matches only. They do not directly set `ResearchContributor.personId`.
- Contributor relationships become linked only through explicit moderator verification/manual linking.
- Publishing a paper/dataset is blocked while proposed contributor matches remain unresolved.
- Approved/rejected paper/dataset records can be edited/reopened and return to review.
- Staff paper/dataset submission supports `submitterPersonId`; staff records the action but the selected registered member is the submitter.
- Staff project creation supports `ownerPersonId`; the selected registered member is the owner.
- Imported project data starts private and is staged as a project change request.
- Imported positions start as drafts.
- MEMBER accounts have personal tasks and weekly reports. ADMIN/MODERATOR accounts do not use those personal workflows; staff retain review queues including weekly-report review.
- `db:rebuild` repopulates processed runtime people images from `backend/seed/assets/people` into `backend/storage/peoples` and verifies the result.
