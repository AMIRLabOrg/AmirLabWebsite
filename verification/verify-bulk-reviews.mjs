import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const checks = [];
const expect = (label, condition) => {
  if (!condition) throw new Error(`Bulk review verification failed: ${label}`);
  checks.push(label);
};

const domains = [
  {
    name: "profile",
    component: "frontend/src/components/profile-review-queue.tsx",
    controller: "backend/src/profiles/profiles.controller.ts",
    service: "backend/src/profiles/profiles.service.ts",
    endpoint: "/profile-reviews/bulk-review",
    route: "profile-reviews/bulk-review",
  },
  {
    name: "research",
    component: "frontend/src/components/research-review-queue.tsx",
    controller: "backend/src/research/research.controller.ts",
    service: "backend/src/research/research.service.ts",
    endpoint: "/research-review/bulk-review",
    route: "research-review/bulk-review",
  },
  {
    name: "project",
    component: "frontend/src/components/project-review-queue.tsx",
    controller: "backend/src/projects/projects.controller.ts",
    service: "backend/src/projects/projects.service.ts",
    endpoint: "/project-change-reviews/bulk-review",
    route: "bulk-review",
  },
  {
    name: "weekly report",
    component: "frontend/src/components/weekly-report-review.tsx",
    controller: "backend/src/weekly-reports/weekly-reports.controller.ts",
    service: "backend/src/weekly-reports/weekly-reports.service.ts",
    endpoint: "/weekly-reports/bulk-review",
    route: "bulk-review",
  },
];

for (const domain of domains) {
  const component = read(domain.component);
  const controller = read(domain.controller);
  const service = read(domain.service);
  expect(`${domain.name} frontend uses the bulk endpoint`, component.includes(domain.endpoint));
  expect(`${domain.name} frontend uses shared bulk selection`, component.includes("useBulkSelection"));
  expect(`${domain.name} frontend renders shared bulk actions`, component.includes("BulkReviewBar"));
  expect(`${domain.name} controller exposes a bulk route`, controller.includes(domain.route));
  expect(`${domain.name} backend has a bulk review service`, service.includes("async bulkReview("));
  expect(`${domain.name} backend uses a transaction`, service.includes("this.prisma.$transaction"));
}

const profile = read("backend/src/profiles/profiles.service.ts");
const research = read("backend/src/research/research.service.ts");
const project = read("backend/src/projects/projects.service.ts");
const weekly = read("backend/src/weekly-reports/weekly-reports.service.ts");
const researchUi = read("frontend/src/components/research-review-queue.tsx");
const projectUi = read("frontend/src/components/project-review-queue.tsx");

expect("profile bulk review claims exact revisions set-wise", profile.includes('FROM (VALUES ${Prisma.join(claimRows)})'));
expect("profile bulk approval updates people set-wise", profile.includes('UPDATE "Person" AS person'));
expect("research bulk review updates selected rows set-wise", research.includes('UPDATE "ResearchItem" AS item'));
expect("research publish rechecks source and contributor guards in SQL", research.includes("ResearchSourceSnapshot") && research.includes("ContributorMatch"));
expect("project bulk approval locks project versions", project.includes("FOR UPDATE"));
expect("project bulk application is grouped/set-based", project.includes("private async applyBulkChanges") && project.includes("createMany"));
expect("weekly reports use one guarded updateMany", weekly.includes("transaction.weeklyReport.updateMany"));
expect("research UI computes action intersection", researchUi.includes("commonResearchBulkStatuses"));
expect("project UI suppresses ambiguous same-project bulk approval", projectUi.includes("hasDuplicateProjects"));
expect("frontend bulk code does not fan out single-item requests", !domains.some(({ component }) => /Promise\.all(?:Settled)?\s*\(/.test(read(component).match(/async function (?:decideBulk|reviewBulk)[\s\S]*?\n  }/)?.[0] ?? "")));

console.log(`Bulk review architecture verified (${checks.length}/${checks.length}).`);
for (const check of checks) console.log(`- ${check}`);
