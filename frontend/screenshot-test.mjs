import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE_URL = process.env.AMIRLAB_SCREENSHOT_URL ?? "http://localhost:3000";
const SCREENSHOT_DIR = path.resolve("screenshots");

async function waitForServer(url, timeout = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await new Promise((resolve, reject) => {
        const request = http.get(url, resolve);
        request.on("error", reject);
        request.setTimeout(2_000, () => {
          request.destroy();
          reject(new Error("timeout"));
        });
      });
      if (response.statusCode === 200) return;
    } catch {
      // Server is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Server did not start within ${timeout}ms: ${url}`);
}

await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
await waitForServer(BASE_URL);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "home.png"),
    fullPage: false,
  });
} finally {
  await browser.close();
}

console.log(`Screenshot saved under ${SCREENSHOT_DIR}`);
