# Workspace layout audit

Status: in progress. New screenshots add findings to this audit; they do not replace outstanding work.

## Acceptance rules

- One full-width dashed divider per parent boundary, with markers at both rails.
- Child rows and sections meet their parent rails and do not cross another column.
- No overlapping solid/dashed strokes, inset decorative boxes, or accidental scrollbars.
- Existing fields, permissions, pending/error states, and form actions remain intact.
- Use the existing local database and credentials on ports 3000/3001. No record edits for visual checks.

## Workstreams

| Workstream | Status |
| --- | --- |
| Active/Alumni admin control and Others label | Implemented; preserve through final regression checks |
| Shared divider ownership | Implemented; final collision checks pending |
| Old inset lines: documents, policies, department roster, account/security settings | Repairs in progress; final reinspection pending |
| Individual project page: header, metrics, tabs, sidebar, all seven views | In progress; highest-priority finding, does not replace the route audit |
| Back navigation variants | Project now reuses existing WorkspaceBackLink; remaining callers under audit |
| Full desktop/mobile workspace audit | In progress; route ledger below |
| Public sibling regression checks, automated checks, final review | Pending |

## Route ledger

Desktop visits completed for all route families. Some early captures showed loading or a role gate and need settled-state reinspection. Mobile visits have reached the first seven routes. This ledger deliberately remains pending until final checks are complete.

| Page file under frontend/src/app/workspace | Final desktop check | Final mobile check | Notes |
| --- | --- | --- | --- |
| `applications/[[...id]]/page.tsx` | Pending final pass | Pending final pass | Existing queue is empty; populated detail state unavailable without changing records. |
| `chat/page.tsx` | Pending final pass | Pending final pass |  |
| `content/[page]/page.tsx` | Pending final pass | Pending final pass |  |
| `content/page.tsx` | Pending final pass | Pending final pass |  |
| `departments/[id]/page.tsx` | Pending final pass | Pending final pass |  |
| `departments/new/page.tsx` | Pending final pass | Pending final pass |  |
| `departments/page.tsx` | Pending final pass | Pending final pass |  |
| `documents/page.tsx` | Pending final pass | Pending final pass |  |
| `notifications/page.tsx` | Pending final pass | Pending final pass |  |
| `page.tsx` | Pending final pass | Pending final pass |  |
| `positions/[id]/page.tsx` | Pending final pass | Pending final pass |  |
| `positions/new/page.tsx` | Pending final pass | Pending final pass |  |
| `positions/page.tsx` | Pending final pass | Pending final pass |  |
| `profile/page.tsx` | Pending final pass | Pending final pass |  |
| `profile-reviews/[[...id]]/page.tsx` | Pending final pass | Pending final pass | Existing queue is empty; populated detail state unavailable without changing records. |
| `programs/page.tsx` | Pending final pass | Pending final pass |  |
| `project-reviews/page.tsx` | Pending final pass | Pending final pass |  |
| `projects/[id]/page.tsx` | Pending final pass | Pending final pass |  |
| `projects/new/page.tsx` | Pending final pass | Pending final pass |  |
| `projects/page.tsx` | Pending final pass | Pending final pass |  |
| `research/[[...id]]/page.tsx` | Pending final pass | Pending final pass | Redirect to submissions. |
| `settings/account/page.tsx` | Pending final pass | Pending final pass |  |
| `settings/backups/page.tsx` | Pending final pass | Pending final pass |  |
| `settings/verification/page.tsx` | Pending final pass | Pending final pass |  |
| `settings/workers/page.tsx` | Pending final pass | Pending final pass |  |
| `submissions/new/page.tsx` | Pending final pass | Pending final pass | Redirect to submissions. |
| `submissions/page.tsx` | Pending final pass | Pending final pass |  |
| `tasks/page.tsx` | Pending final pass | Pending final pass | Member-only content: current browser session is ADMIN; source reviewed, live content not verified. |
| `universities/[id]/page.tsx` | Pending final pass | Pending final pass |  |
| `universities/new/page.tsx` | Pending final pass | Pending final pass |  |
| `universities/page.tsx` | Pending final pass | Pending final pass |  |
| `users/[id]/edit/page.tsx` | Pending final pass | Pending final pass |  |
| `users/new/page.tsx` | Pending final pass | Pending final pass |  |
| `users/page.tsx` | Pending final pass | Pending final pass |  |
| `weekly-reports/page.tsx` | Pending final pass | Pending final pass | Member-only content: current browser session is ADMIN; source reviewed, live content not verified. |
| `weekly-reports/review/[[...id]]/page.tsx` | Pending final pass | Pending final pass | Existing queue is empty; populated detail state unavailable without changing records. |

## Findings retained for follow-up

- Projects empty state had both intrinsic solid borders and parent frame rules. Removed embedded StatePanel borders and migrated the project toolbar to the shared band; mobile computed top/bottom borders verified as zero.
- Document approval facts had an inset double-border box. Reused WorkspaceRecordRow so its divider meets parent rails.
- Nested project forms initially inherited full-width utility offsets despite containment CSS. Corrected CSS precedence; measured child form lines matching the pane width.
- Project header, status strip, navigation and child views still mix old layout conventions; redesign pending.
- Next.js development insight on dynamic project params: runtime data blocks instant navigation. Observed, not suppressed; outside divider scope.
- Existing local document approval signature asset is missing; no upload or record change attempted.

- Follow-up project check found nested solid strokes overridden by the utility layer; corrected cascade. Project list separators now meet pane rails rather than drawing inset top boxes. All seven views still require final browser checks.

- Back navigation: shared WorkspaceBackLink now uses accent text without a hover underline, with no button padding or background, as explicitly requested.
- Project follow-up: aligned all tab and sidebar header heights; padded pagination and empty text to content gutter; aligned member action; removed empty list grid tracks.
- Intersection follow-up: column marker accounts for border width; FrameRule wrapper no longer creates a stacking context over other markers. Strokes use z-20 and markers z-30.
