import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  "..",
);
const checks = [];
const failures = [];
async function source(relative) {
  return readFile(path.join(root, relative), "utf8");
}
function expect(name, condition) {
  checks.push(name);
  if (!condition) failures.push(name);
}

const navigation = await source("frontend/src/lib/workspace-navigation.ts");
const workspacePages = await readdir(
  path.join(root, "frontend/src/app/workspace"),
  { recursive: true },
);
for (const page of workspacePages.filter((file) => file.endsWith("page.tsx"))) {
  const pageSource = await source(`frontend/src/app/workspace/${page}`);
  expect(
    `workspace page ${page} retains its access gate`,
    /WorkspacePageShell|WorkspaceContent|redirect\(/.test(pageSource),
  );
}
const workspaceLayout = await source("frontend/src/app/workspace/layout.tsx");
const workspaceShell = await source(
  "frontend/src/components/workspace-shell.tsx",
);
expect(
  "workspace layout has a meaningful suspense fallback",
  workspaceLayout.includes("fallback={<WorkspaceLoading />}") &&
    !workspaceLayout.includes("instant = false"),
);
expect(
  "workspace shell renders route segments without suppressing validation",
  workspaceShell.includes(
    "<Suspense fallback={<WorkspaceLoading />}>{children}</Suspense>",
  ) && !workspaceShell.includes("? null : children"),
);
expect(
  "member navigation contains My tasks",
  navigation.includes('label: "My tasks"'),
);
expect(
  "member navigation contains Weekly reports",
  navigation.includes('label: "Weekly reports"'),
);
expect("staff navigation is separate", navigation.includes("const STAFF_WORK"));
expect(
  "research library replaces the manual review navigation",
  navigation.includes('href: "/workspace/submissions"') &&
    !navigation.includes('href: "/workspace/research"'),
);
expect(
  "staff review contains Weekly report reviews",
  navigation.includes('label: "Weekly report reviews"'),
);

const memberOnly = await source("frontend/src/components/member-only.tsx");
expect(
  "member-only guard checks MEMBER",
  /role\s*!==\s*"MEMBER"/.test(memberOnly),
);
for (const route of [
  "frontend/src/app/workspace/tasks/page.tsx",
  "frontend/src/app/workspace/weekly-reports/page.tsx",
]) {
  const routeSource = await source(route);
  expect(`${route} uses MemberOnly`, routeSource.includes("MemberOnly"));
}

const controller = await source("backend/src/research/research.controller.ts");
expect(
  "manual research entry and review routes are retired",
  !/@(?:Post|Patch)\(['"](?:research|research-review)/.test(controller),
);
const sync = await source("backend/src/research/openalex.service.ts");
expect(
  "author sync commits atomically",
  sync.includes("this.prisma.$transaction"),
);
const library = await source("frontend/src/components/research-library.tsx");
expect(
  "research library is source-read-only",
  library.includes("source metadata is read-only") &&
    !library.includes("ResearchEditor"),
);
const publication = await source(
  "frontend/src/components/publication-explorer.tsx",
);
expect(
  "publication search uses the shared submission policy",
  publication.includes("ToolbarSearchField") &&
    publication.includes("onSearch="),
);

const projectDto = await source("backend/src/projects/dto/project.dto.ts");
expect(
  "project DTO supports ownerPersonId",
  projectDto.includes("ownerPersonId"),
);
const rebuild = await source("backend/scripts/rebuild-db.ts");
expect(
  "seeded initial profiles publish directly",
  rebuild.includes("profileUpdateData(") &&
    rebuild.includes("isPublished: true"),
);
expect(
  "seed does not create profile review requests",
  !rebuild.includes("profileEditRequest.create("),
);
expect(
  "seed excludes manually entered papers",
  !rebuild.includes("for (const paper of data.papers)"),
);
expect(
  "imported project public page disabled",
  rebuild.includes("publicPageEnabled: false"),
);

const workspaceService = await source(
  "backend/src/workspace/workspace.service.ts",
);
expect(
  "personal tasks reject staff",
  /role\s*!==\s*PlatformRole\.MEMBER/.test(workspaceService),
);
const weekly = await source(
  "backend/src/weekly-reports/weekly-reports.service.ts",
);
expect(
  "weekly report personal APIs require MEMBER",
  weekly.includes("requireMember"),
);

if (failures.length) {
  console.error("Workflow contract verification failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`Workflow contracts verified (${checks.length}/${checks.length}).`);
for (const check of checks) console.log(`- ${check}`);
