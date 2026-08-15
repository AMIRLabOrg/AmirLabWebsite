# Page audit

The Tailwind migration preserves all App Router page files from the uploaded baseline. Every page source was included in the syntax/import/style architecture audit. Live route execution is covered by `frontend/e2e/route-smoke.spec.ts` when the backend, rebuilt database and frontend are running.

**Total App Router pages: 48**

| Route | Access | Route kind | Source audit |
|---|---|---|---|
| `/about` | Public/guest | Static | PASS |
| `/auth/setup` | Guest/token | Static | PASS |
| `/datasets` | Public/guest | Static | PASS |
| `/departments/[slug]` | Public/guest | Dynamic | PASS |
| `/departments` | Public/guest | Static | PASS |
| `/login` | Public/guest | Static | PASS |
| `/open-positions` | Public/guest | Static | PASS |
| `/` | Public/guest | Static | PASS |
| `/papers` | Public/guest | Static | PASS |
| `/people/[slug]` | Public/guest | Dynamic | PASS |
| `/people` | Public/guest | Static | PASS |
| `/projects/[slug]` | Public/guest | Dynamic | PASS |
| `/projects` | Public/guest | Static | PASS |
| `/workspace/applications/[id]` | ADMIN | Dynamic | PASS |
| `/workspace/applications` | ADMIN | Static | PASS |
| `/workspace/chat` | Authenticated | Static | PASS |
| `/workspace/content/[page]` | ADMIN | Dynamic | PASS |
| `/workspace/content` | ADMIN | Static | PASS |
| `/workspace/departments/[id]` | ADMIN | Dynamic | PASS |
| `/workspace/departments/new` | ADMIN | Static | PASS |
| `/workspace/departments` | ADMIN | Static | PASS |
| `/workspace/notifications` | Authenticated | Static | PASS |
| `/workspace` | Authenticated | Static | PASS |
| `/workspace/positions/[id]` | ADMIN | Dynamic | PASS |
| `/workspace/positions/new` | ADMIN | Static | PASS |
| `/workspace/positions` | ADMIN | Static | PASS |
| `/workspace/profile` | Authenticated | Static | PASS |
| `/workspace/profile-reviews/[id]` | MODERATOR+ | Dynamic | PASS |
| `/workspace/profile-reviews` | MODERATOR+ | Static | PASS |
| `/workspace/programs` | Authenticated | Static | PASS |
| `/workspace/project-reviews` | MODERATOR+ | Static | PASS |
| `/workspace/projects/[id]` | Authenticated | Dynamic | PASS |
| `/workspace/projects/new` | Authenticated | Static | PASS |
| `/workspace/projects` | Authenticated | Static | PASS |
| `/workspace/research/[id]` | MODERATOR+ | Dynamic | PASS |
| `/workspace/research` | MODERATOR+ | Static | PASS |
| `/workspace/settings/verification` | ADMIN | Static | PASS |
| `/workspace/submissions/new` | Authenticated | Static | PASS |
| `/workspace/submissions` | Authenticated | Static | PASS |
| `/workspace/tasks` | MEMBER | Static | PASS |
| `/workspace/universities/[id]` | ADMIN | Dynamic | PASS |
| `/workspace/universities/new` | ADMIN | Static | PASS |
| `/workspace/universities` | ADMIN | Static | PASS |
| `/workspace/users/[id]/edit` | ADMIN | Dynamic | PASS |
| `/workspace/users/new` | ADMIN | Static | PASS |
| `/workspace/users` | ADMIN | Static | PASS |
| `/workspace/weekly-reports` | MEMBER | Static | PASS |
| `/workspace/weekly-reports/review` | MODERATOR+ | Static | PASS |
