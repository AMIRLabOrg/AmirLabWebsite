import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const frontendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const srcRoot = path.join(frontendRoot, "src");
async function walk(directory) {
  const out = [];
  for (const entry of await readdir(directory)) {
    const target = path.join(directory, entry);
    const info = await stat(target);
    if (info.isDirectory()) out.push(...await walk(target));
    else out.push(target);
  }
  return out;
}
const files = await walk(srcRoot);
const failures = [];
const css = files.filter((file) => file.endsWith(".css"));
const expectedCss = path.join(srcRoot, "app", "globals.css");
if (css.length !== 1 || css[0] !== expectedCss) {
  failures.push(`Expected only src/app/globals.css; found: ${css.map((file) => path.relative(frontendRoot, file)).join(", ")}`);
}
for (const file of files.filter((file) => /\.(?:ts|tsx)$/.test(file))) {
  const relative = path.relative(frontendRoot, file);
  const source = await readFile(file, "utf8");
  if (/\.module\.css|@\/styles\/|import\s+["'][^"']+\.css["']/.test(source) && relative !== "src/app/layout.tsx") failures.push(`${relative}: non-global CSS import`);
  if (/const\s+styles\s*=|className=\{styles\.|<style(?:\s|>)/.test(source)) failures.push(`${relative}: CSS-in-TS/style-tag pattern`);
  if (/style\s*=\s*\{\{/.test(source)) failures.push(`${relative}: inline style object used for ordinary styling`);
  if (/\[&_\.[A-Za-z][^\]]*\]/.test(source)) failures.push(`${relative}: selector-dump arbitrary variant`);
}
const globals = await readFile(expectedCss, "utf8");
if (!globals.startsWith('@import "tailwindcss";')) failures.push("globals.css does not import Tailwind v4");
if (/\.(?:button|card|panel|hero|workspace|record|field|badge)[-{.#]/.test(globals)) failures.push("globals.css contains component/page class styling");
if (failures.length) {
  console.error("Tailwind architecture verification failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log("Tailwind architecture verified.");
console.log("- only src/app/globals.css exists");
console.log("- no CSS Modules/page stylesheets/style objects/style tags");
console.log("- component/page styling is expressed with Tailwind utilities in TSX");
