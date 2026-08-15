# Lab and project management completion plan

> Superseded as the platform-level migration authority by
> `../lab-management-migration.localplan.md`. Keep this file as the detailed
> project/collaboration workstream and issue history.

## Why this plan exists

The visible workspace does not yet satisfy the main lab-management requirement. Chat is the only clearly new end-to-end feature. Project-management models and partial screens exist, but they are not yet presented as one coherent workflow that a lab can operate from.

Use this file as the resume point for the remaining migration and product work. Validate every item against live frontend/backend state before implementation because some foundations may change while other issues are handled.

## Product boundary

- Lab management owns lab-wide operations:
  - people, accounts, departments, roles, permissions, positions, applications, review queues, policies, notifications, and public-site governance;
  - the registry of projects, papers, datasets, and their relationships.
- Project management is a module inside the lab platform:
  - project team, access, objectives, milestones, tasks, assignments, deadlines, progress, updates, resources, outputs, activity, and project chat.
- Projects, papers, and datasets may share backend research identity where useful, but the UI must keep their workflows separate:
  - papers and datasets are research outputs;
  - projects are internal managed workspaces that may later have a public page;
  - admin pages are review/governance surfaces, not personal creation surfaces.

## Decisions already made

### Project canonical URL

- Do not require an external canonical URL when creating an internal project.
- The platform-generated project record and slug are the canonical internal identity.
- Repository, grant, funding, lab, and external project pages belong under optional project resources.
- A supporting external URL may be requested later when publishing a public project page, but it must not block internal creation.
- Papers and datasets may continue requiring canonical source URLs because source verification is part of those workflows.

### Contributors and people

- Project contributors must be selected from registered people using the existing searchable selector/list UI.
- Store canonical `personId` relationships, not names or email strings that only match later.
- Preserve contributor order and allow selected people to be removed/reordered.
- Paper/dataset contributor entry must still allow external people who are not registered in the lab system.
- A later paper/dataset author editor may support both free-text external authors and optional registered-person links.

### Public versus private data

- Internal project operations are private by default.
- Public project information must be an explicit publication projection, not the complete internal record.
- Public candidates: title, summary/objective, selected contributors, department, status, selected milestones, published updates, outputs, and approved resources.
- Private by default: internal chat, tasks, assignments, internal deadlines, drafts, review notes, access settings, private resources, and operational activity.

## Current implementation reality

- Chat has a persistent lab conversation, project conversations, realtime messages, Redis presence snapshots, typing, replies, reactions, system activity, push hooks, and responsive UI foundations. Chat is intentionally hidden from the workspace shell while management workflows are completed; its route/code remain available.
- Chat UI and interaction acceptance still requires continued visual testing against the supplied reference.
- Dedicated project creation now creates a private internal project, canonical registered-person memberships, department relationship, owner access, project conversation, and initial system activity in one transaction without an external URL.
- Project creation is separated from paper/dataset submission in both API validation and frontend routing.
- The project workspace now has a clear project identity header plus overview, assignable tasks, milestones, updates, people/access, outputs/resources, and settings. Tasks store assignee, status, priority, due date, actor, and timestamps.
- Project task and project-change activity is persisted to the project conversation and broadcast in realtime.
- Shared input, textarea, select, and searchable-select dimensions/typography now come from the reusable UI controls instead of project/page descendant overrides.
- Notifications still use their existing transport instead of one unified realtime event pipeline.
- System activity is not yet consistently emitted into project/lab chat.
- Browser push requires production VAPID configuration.
- Redis-compatible presence/fanout exists, but production Redis setup and multi-instance behavior still require deployment verification.
- A concrete legacy-data migration/import workflow has not been implemented or proven.

### 2026-07-28 verification checkpoint

- Member project creation completed in the browser and redirected to a usable private workspace.
- Task creation completed through the real API and appeared in the project workspace.
- Chat navigation count in the workspace shell verified as zero while chat code/routes remain intact.
- Shared project Settings and Updates inputs both computed to 48px height, 14.4px text, and 12px 16px padding.
- Desktop screenshots captured for project creation, project identity/tasks, Updates, Settings, and the final Administration section boundary; mobile project creation was also captured.
- Backend: build passed, migration `20260728190000_project_tasks` applied, and all 22 suites / 90 tests passed.
- Frontend: production `next build --webpack` passed; targeted changed-file lint and `git diff --check` passed. The repository-wide lint command still reports the pre-existing CommonJS `screenshot-test.js` errors and unrelated image warnings.

## Required workflow

### 1. Internal project creation

- Keep `/workspace/projects/new` as the member-side project creation route.
- Replace research-publication language with internal project language.
- Required fields:
  - title;
  - objective or concise summary;
  - owner;
  - at least one registered contributor;
  - responsible department or lab unit;
  - initial status.
- Optional fields:
  - start and target-end dates;
  - visibility/publication intent;
  - repositories, grant pages, funding pages, or other resources.
- External canonical URL must be optional or absent from this initial form.
- Creation must produce a usable private workspace immediately.

### 2. Project workspace

- Present one coherent workspace with clear navigation for:
  - overview and progress;
  - objectives;
  - milestones;
  - tasks and assignments;
  - updates/activity;
  - people and access;
  - resources and documents;
  - related papers/datasets;
  - chat;
  - public-page settings.
- Owners/managers must be able to assign work to registered project members.
- Progress must derive from defined project work rather than an unexplained manual number.
- Empty states must direct the next useful action.

### 3. Roles and access

- Define and enforce project roles such as owner, manager, contributor, and viewer.
- Keep platform roles separate from project roles.
- Define permissions for managing people, posting updates, editing plans, assigning work, changing visibility, and publishing.
- Member selection must use registered entities; do not use manual IDs or arbitrary emails when an internal person exists.
- Invitation behavior for people without accounts must be an explicit separate path, not mixed into normal member selection.

### 4. Objectives, milestones, tasks, and progress

- Objectives explain intended outcomes.
- Milestones represent measurable project checkpoints.
- Tasks represent assignable operational work and need owner, status, priority, and optional due date.
- Progress rules must be visible and deterministic.
- Status changes should retain actor and timestamp history.
- Blocked work must be visible on project overview and relevant member dashboards.

### 5. Updates and activity

- Maintain a structured project activity timeline.
- Emit system activity for important changes, including:
  - project created or status changed;
  - contributor joined/left or access changed;
  - objective/milestone/task created, updated, completed, or blocked;
  - update published;
  - resource/output linked;
  - public visibility changed;
  - review requested, approved, rejected, or returned for changes.
- Important project activity should also appear in the project conversation as system messages such as “X completed milestone Y.”
- Do not create visible join/leave socket-room noise; these are persistent membership events, not temporary room events.

### 6. Chat and collaboration completion

- Keep persistent lab, project, and direct conversations.
- Show active members without user-visible room join/leave semantics.
- Complete and verify:
  - first/middle/last message grouping;
  - avatar only on the final message of a group where appropriate;
  - connected middle corners and rounded final corners;
  - quoted replies;
  - persisted reactions loaded with message history;
  - date separators;
  - typing start/stop lifecycle;
  - unread/read behavior;
  - scroll-to-latest and history loading;
  - desktop and mobile layouts;
  - keyboard and focus behavior.
- Screenshot-verify member and admin views before declaring acceptance.

### 7. Notifications and browser push

- Route chat and domain activity through one authorized realtime event pipeline.
- Preserve durable notification records independently from websocket delivery.
- Update unread counts and notification lists without page refresh.
- Browser push should notify offline/background users and avoid notifying the active sender unnecessarily.
- Verify Redis fanout/presence and push behavior in the deployment environment.

### 8. Review and publication

- Internal project creation and private operation must not require immediate public review.
- Public project publication may require configurable review.
- Admin/director workflow should be accept, reject, request changes, verify links, and manage policy—not “create as admin” as the normal route.
- Public page settings must show exactly what will be exposed before publication.
- Public pages must never leak private project operations.

### 9. Research-output separation

- Rebuild `/workspace/submissions` as a member research-output dashboard.
- Tabs: papers, datasets, and claims/relationships.
- Keep project records out of this page.
- Keep `/workspace/submissions/new` for paper/dataset submission only.
- External text contributors remain allowed for papers/datasets.
- Registered-person linking remains a separate verification capability unless a mixed author editor is implemented.

### 10. Migration/import workflow

- Inventory every legacy lab-management entity and source before writing import code.
- Define mappings for people, accounts, departments, projects, memberships, outputs, files/resources, statuses, dates, and historical updates.
- Identify unsupported or ambiguous legacy data and produce a review report rather than silently dropping it.
- Imports must be idempotent or have a documented rollback/retry strategy.
- Preserve source identifiers for traceability.
- Run a dry import, compare counts and representative records, then obtain explicit approval before production migration.

## Acceptance criteria

- A member can create an internal project without an external URL.
- Project contributors are canonical registered-person relationships.
- The created project opens as a usable private workspace.
- Authorized users can manage the team, work plan, progress, resources, outputs, updates, and visibility from one coherent workflow.
- Important changes generate durable activity, realtime notifications, and appropriate project-chat system messages.
- Public viewers see only explicitly approved project information.
- Papers/datasets remain distinct from projects and retain valid external-author workflows.
- Member/admin desktop and mobile paths are behaviorally tested and screenshot-verified.
- Migration is validated by count reconciliation, sampled record comparison, and an ambiguity report.

## Verification checklist

- Frontend TypeScript, targeted lint, production `next build --webpack`, and `git diff --check`.
- Backend build, relevant unit/request tests, full test suite, and `git diff --check`.
- Two-account realtime test for messages, typing, presence, reactions, notifications, and system activity.
- Browser push test with an inactive/background account.
- Desktop and mobile screenshots for project creation, project workspace, chat, review, and public project views.
- Permission tests for member, project manager, moderator, and administrator boundaries.
- Migration dry-run report and repeat-run/idempotency test.

## Issue inbox

Append newly reported issues here before changing code. For each issue record:

- observed behavior and screenshot/path;
- expected behavior;
- affected role and route;
- likely owning frontend/backend module;
- dependency on another workstream;
- acceptance check;
- implementation status and commit when completed.

### Resolved issues awaiting commit

- Role-scoped general profiles:
  - administrator profiles expose account image, full name, and account email;
  - moderator profiles expose full name, phone, and contact address;
  - research members retain the full research profile with biography, headline, expertise, links, and custom sections;
  - backend payload validation and update logic enforce the same scopes and preserve fields outside the permitted scope;
  - administrator email edits update both account authentication identity and the linked person record;
  - live admin verification confirmed only image, full name, and email are rendered.
- Shared-control regressions and milestone row consistency:
  - profile-review search now uses the shared `InputControl` after removal of page-wide native input styling;
  - milestone status no longer inherits the remove action's danger styles because remove styling targets `.milestone-remove` only;
  - milestone title and status now have labels matching Weight and Progress, all controls align on the shared 48px row, and removal uses the existing trash icon;
  - live computed checks confirmed 48px controls, 14.4px text, pill radii, and neutral status text.
- Project form component rules:
  - project start, end, and task due dates use the shared custom `DateField`; no native date or datetime inputs remain under workspace components;
  - project contributor selectors include registered accounts in both `PENDING_SETUP` and `ACTIVE` states, while suspended and archived accounts remain unavailable;
  - the same availability rule is enforced by project creation and internal member addition, not only by the options UI;
  - profile editor loading skeletons mirror the rendered role-specific composition for administrator, moderator, and research-member accounts.
- Interaction rules:
  - searchable selectors keep focus in the search input while Up/Down changes the active option and Enter selects it; Left/Right and normal text editing retain native cursor behavior;
  - live keyboard verification confirmed the search input remained focused with its cursor position and query intact after ArrowDown;
  - retained chat code scrolls its own message viewport to the latest activity, auto-grows the shared textarea composer to 140px, sends on Enter with Shift+Enter for a newline, and refocuses the composer after a successful send.
- Workspace page alignment audit:
  - shared record-page intros are constrained to the same narrow width as forms; intros should span the available content width with a full divider;
  - record forms such as new project and new account are too narrow and need a wider, consistent form measure;
  - bounded dashboard/profile/position content is left-biased and must be centered within the workspace content region;
  - full-width notification/filter/list pages need intentional left/right gutters and a centered maximum width;
  - audit every `/workspace/**` route for the same narrow, full-bleed, or left-biased geometry;
  - preserve intentionally full-height/full-bleed surfaces such as chat;
  - verify representative desktop and mobile routes with screenshots before closing the audit.
  - implementation status: fixed in the working tree on 2026-07-28;
  - shared workspace pages now use a centered 1280px wide shell, while overview, profile, and position compositions use a centered 1180px measure;
  - record intros now span the 1280px shell and record cards use a centered 820px form measure;
  - mobile notification cards now collapse to one content column with a full-width action row;
  - browser audit covered 22 static `/workspace/**` routes at 1920px with zero left/right gutter delta, plus representative 390px screenshots for overview, profile, notifications, positions, account creation, and project creation;
  - chat remains intentionally edge-to-edge and was excluded from bounded-page geometry.
- Account action-row compression:
  - the three desktop account actions exceeded the old 300px action column, allowing the primary access-email button to shrink and wrap into a tall pill;
  - implementation status: fixed in the working tree on 2026-07-28 by reserving a 360px action column and making action controls non-shrinking/non-wrapping;
  - verified rendered sizes: Edit 86x44px, Delete 102x44px, Send access email 157x44px;
  - scanned visible action buttons across the comparable workspace queue, review, notification, position, profile, project, submission, university, and account routes; no other compressed or over-height visible controls were found.
