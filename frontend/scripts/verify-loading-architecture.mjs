import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const frontendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcRoot = path.join(frontendRoot, "src");

async function walk(directory) {
  const entries = await readdir(directory);
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry);
    const info = await stat(target);
    if (info.isDirectory()) files.push(...await walk(target));
    else files.push(target);
  }
  return files;
}

const files = await walk(srcRoot);
const sourceFiles = files.filter((file) => /\.(?:ts|tsx)$/.test(file));
const failures = [];
let placeholderCount = 0;
let loadingStateCount = 0;
let placeholderStyleCount = 0;

for (const file of sourceFiles) {
  const relative = path.relative(frontendRoot, file);
  const source = await readFile(file, "utf8");
  if (/skeleton/i.test(relative) || /(?:^|[^a-z])skeleton(?:[^a-z]|$)/i.test(source)) {
    failures.push(`${relative}: parallel skeleton terminology remains`);
  }
  placeholderCount += (source.match(/data-placeholder/g) ?? []).length;
  loadingStateCount += (source.match(/data-loading/g) ?? []).length;
  placeholderStyleCount += (source.match(/loadingPlaceholder\(/g) ?? []).length;

  if (source.includes("data-placeholder") && !source.includes("loadingPlaceholder(")) {
    failures.push(`${relative}: placeholder nodes exist without Tailwind loading presentation`);
  }
}

const loadingRoutes = files.filter((file) => file.endsWith(`${path.sep}loading.tsx`));
for (const file of loadingRoutes) {
  const source = await readFile(file, "utf8");
  const relative = path.relative(frontendRoot, file);
  if (!source.includes(" loading") || /<(?:div|section|article|main)\b/.test(source)) {
    failures.push(`${relative}: route loading file must delegate to the normal view in loading state`);
  }
}

if (placeholderCount < 100) failures.push(`Only ${placeholderCount} real data placeholders found`);
if (placeholderStyleCount < 100) failures.push(`Only ${placeholderStyleCount} Tailwind placeholder styles found`);
if (loadingStateCount < 50) failures.push(`Only ${loadingStateCount} loading-state hooks found`);

if (failures.length) {
  console.error("Loading architecture verification failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Loading architecture verified.");
console.log(`- ${loadingRoutes.length} route loading files delegate to normal views`);
console.log(`- ${placeholderCount} real-node placeholder hooks`);
console.log(`- ${placeholderStyleCount} Tailwind placeholder presentations`);
console.log(`- no parallel skeleton component/style tree`);
