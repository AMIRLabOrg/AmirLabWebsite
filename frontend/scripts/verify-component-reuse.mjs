import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const frontendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcRoot = path.join(frontendRoot, "src");

async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory)) {
    const target = path.join(directory, entry);
    const info = await stat(target);
    if (info.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

const files = (await walk(srcRoot)).filter((file) => /\.(?:ts|tsx)$/.test(file));
const failures = [];
const sources = new Map();
for (const file of files) sources.set(file, await readFile(file, "utf8"));

const avatarImplementations = [...sources.entries()].filter(([, source]) => /(?:export\s+)?function\s+ProfileAvatar\b/.test(source));
if (avatarImplementations.length !== 1) failures.push(`Expected one ProfileAvatar implementation; found ${avatarImplementations.length}`);
const avatarFile = path.join(srcRoot, "components", "profile-avatar.tsx");
const avatarSource = sources.get(avatarFile) ?? "";
if (!avatarSource.includes('shape?: "control" | "round"')) failures.push("ProfileAvatar must expose the shared shape API");

for (const consumer of ["site-header.tsx", "workspace-shell.tsx", "workspace-chat.tsx", "profile-editor.tsx"]) {
  const file = path.join(srcRoot, "components", consumer);
  const source = sources.get(file) ?? "";
  if (!source.includes("ProfileAvatar")) failures.push(`${consumer}: does not reuse ProfileAvatar`);
}
for (const consumer of ["site-header.tsx", "workspace-shell.tsx"]) {
  const file = path.join(srcRoot, "components", consumer);
  const source = sources.get(file) ?? "";
  if (!/<ProfileAvatar[^>]*shape="round"/.test(source)) failures.push(`${consumer}: navbar ProfileAvatar must be round`);
}

const manualButtonPattern = /inline-flex\s+min-h-\[(?:42px|var\(--control-height\))\][^"'`\n]*rounded-control[^"'`\n]*border-transparent/;
const duplicateFieldPattern = /grid\s+content-start\s+gap-\[\.45rem\]/;
for (const [file, source] of sources) {
  const relative = path.relative(frontendRoot, file);
  if (!relative.startsWith("src/components/ui/") && /<(?:input|select|textarea)\b/.test(source)) {
    failures.push(`${relative}: raw HTML form control remains outside shared UI controls`);
  }
  if (!relative.endsWith("src/components/ui/button-control.tsx") && manualButtonPattern.test(source)) {
    failures.push(`${relative}: duplicates the shared button-control implementation`);
  }
  if (!relative.endsWith("src/components/ui/form-field.tsx") && duplicateFieldPattern.test(source)) {
    failures.push(`${relative}: duplicates the shared FormField wrapper`);
  }
  if (/const\s+styles\s*=|styles\.scope|\[&_\.[A-Za-z]/.test(source)) {
    failures.push(`${relative}: contains selector-dump/CSS-in-TS styling`);
  }
}

const skeletonFiles = files.filter((file) => /skeleton/i.test(path.basename(file)));
if (skeletonFiles.length) failures.push(`Dedicated skeleton components remain: ${skeletonFiles.map((file) => path.relative(frontendRoot, file)).join(", ")}`);

if (failures.length) {
  console.error("Component reuse verification failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Component reuse verified.");
console.log("- one shared ProfileAvatar is reused, with round avatars in both public and workspace navs");
console.log("- native form controls are encapsulated by shared UI controls");
console.log("- generic button implementation is centralized in ButtonControl/ButtonLink/ButtonAnchor");
console.log("- repeated field wrapper is centralized in FormField");
console.log("- no selector-dump styling or dedicated skeleton component tree");
