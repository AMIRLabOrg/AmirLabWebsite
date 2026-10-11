import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getPublicCacheConfig } from "../src/lib/cache-config.mjs";

const require = createRequire(import.meta.url);
const { JSDOM } = require("jsdom");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

if (!getPublicCacheConfig().enabled) {
  console.log("Public prerender check skipped: caching is disabled.");
} else {
  for (const page of [
    "index",
    "about",
    "people",
    "departments",
    "papers",
    "datasets",
    "projects",
    "open-positions",
  ]) {
    const html = await readFile(
      resolve(root, `.next/server/app/${page}.html`),
      "utf8",
    );
    // Scripts stay disabled: content inside React streaming containers is not visible.
    const document = new JSDOM(html).window.document;
    const visible = (node) => !node.closest("[hidden]");
    const headings = [...document.querySelectorAll("main h1")].filter(
      (node) =>
        visible(node) &&
        node.getAttribute("aria-hidden") !== "true" &&
        node.textContent.trim(),
    );
    assert.ok(
      headings.length,
      `${page}: real heading must be visible without JavaScript`,
    );
    if (page !== "index" && page !== "open-positions") {
      const loading = [
        ...document.querySelectorAll('main [data-loading="true"]'),
      ].filter(visible);
      assert.equal(
        loading.length,
        0,
        `${page}: cached core content must not paint as placeholders`,
      );
    }
    console.log(
      `PASS: ${page} has visible published content without JavaScript`,
    );
  }
}
