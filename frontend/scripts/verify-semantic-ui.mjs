import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

function expect(condition, message) {
  if (!condition) failures.push(message);
}

const publicFiles = [
  "src/components/page-intro.tsx",
  "src/components/about-page-view.tsx",
  "src/components/open-positions-page-view.tsx",
  "src/components/papers-page-view.tsx",
  "src/components/people-page-view.tsx",
  "src/components/people-layout-showcase.tsx",
  "src/components/profile-records.tsx",
  "src/components/research-listing.tsx",
  "src/components/position-list.tsx",
  "src/app/departments/page.tsx",
  "src/app/projects/[slug]/page.tsx",
];
const publicSource = publicFiles.map(read).join("\n");
for (const token of ["PUB /", "DIR /", "UNIT /", "OPP /", "DATA /", "PROJ /", "INDEX"]) {
  expect(!publicSource.includes(token), `Public UI still contains decorative sequence token: ${token}`);
}

const profileQueue = read("src/components/profile-review-queue.tsx");
expect(profileQueue.includes("request.payload.publicEmail"), "Profile review queue must show the submitted public email.");
expect(!profileQueue.includes("request.person.publicEmail"), "Profile review queue must not infer submitted email from the published person record.");
expect(!profileQueue.includes("No public email"), "Profile review queue must use 'Not provided' for an absent submitted email.");
expect(profileQueue.includes("<ReviewIssueStamp"), "Profile review queue must mark item-specific issues.");
expect(profileQueue.includes('tone="warning">Not provided'), "Missing submitted email must use warning styling.");

const bulkBar = read("src/components/bulk-review-bar.tsx");
expect(!/\{error\s*(?:&&|\?)/.test(bulkBar), "Bulk review bar must not own a persistent server-error panel.");
expect(bulkBar.includes("attentionCount"), "Bulk review bar must expose compact item-attention state.");

const itemIssueFiles = [
  "src/components/profile-review-queue.tsx",
  "src/components/profile-review-detail.tsx",
  "src/components/research-review-queue.tsx",
  "src/components/project-review-queue.tsx",
  "src/components/weekly-report-review.tsx",
  "src/components/application-review-queue.tsx",
  "src/components/application-review-detail.tsx",
  "src/components/research-connections-panel.tsx",
  "src/components/position-admin.tsx",
  "src/components/user-management.tsx",
  "src/components/department-admin.tsx",
  "src/components/notification-inbox.tsx",
];
for (const file of itemIssueFiles) {
  expect(read(file).includes("ReviewIssueStamp"), `${file} must visually mark item-specific failures or attention states.`);
}

const clientApi = read("src/lib/client-api.ts");
expect(clientApi.includes("safeStatusMessage"), "Client API must retain safe fallback messages.");
expect(clientApi.includes("ApiRequestError"), "Client API must expose structured safe errors.");

if (failures.length) {
  console.error("Semantic UI verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Semantic UI contracts verified (${publicFiles.length} public surfaces, ${itemIssueFiles.length} item-action surfaces).`);
