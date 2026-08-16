import { readFile } from "node:fs/promises";
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
  "review label is Papers & datasets review",
  navigation.includes('label: "Papers & datasets review"'),
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

const researchReview = await source("backend/src/research/research.service.ts");
expect(
  "research publish blocks proposed contributor matches",
  researchReview.includes("ContributorMatchStatus.PROPOSED"),
);
const relationships = await source(
  "backend/src/research/research-relationships.service.ts",
);
expect(
  "contributor verification explicitly handles VERIFIED",
  relationships.includes("ContributorMatchStatus.VERIFIED"),
);
const discovery = await source(
  "backend/src/research/research-discovery.service.ts",
);
expect(
  "discovered contributor candidates remain PROPOSED",
  discovery.includes("ContributorMatchStatus.PROPOSED"),
);

const projectDto = await source("backend/src/projects/dto/project.dto.ts");
expect(
  "project DTO supports ownerPersonId",
  projectDto.includes("ownerPersonId"),
);
const researchDto = await source("backend/src/research/dto/research.dto.ts");
expect(
  "research DTO supports submitterPersonId",
  researchDto.includes("submitterPersonId"),
);

const rebuild = await source("backend/scripts/rebuild-db.ts");
expect(
  "imported people are not auto-published",
  rebuild.includes("isPublished: false"),
);
expect(
  "imported papers enter NEEDS_REVIEW",
  rebuild.includes("ReviewStatus.NEEDS_REVIEW"),
);
expect(
  "imported contributor matches are PROPOSED",
  rebuild.includes("ContributorMatchStatus.PROPOSED"),
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
