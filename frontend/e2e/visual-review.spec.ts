import { mkdir } from "node:fs/promises";
import path from "node:path";
import { test, type Page } from "@playwright/test";

const outputRoot = path.resolve(process.cwd(), "..", "verification", "runtime-screenshots");

async function loginAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.AMIRLAB_E2E_ADMIN_EMAIL ?? "admin@amirl.local");
  await page.getByLabel("Password").fill(process.env.AMIRLAB_E2E_ADMIN_PASSWORD ?? "AmirlabLocal2026!");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/workspace(?:$|\/)/);
}

async function capture(page: Page, projectName: string, name: string) {
  await mkdir(outputRoot, { recursive: true });
  await page.screenshot({ fullPage: true, path: path.join(outputRoot, `${name}-${projectName}.png`) });
}

test("capture public Scientific Index surfaces", async ({ page }, testInfo) => {
  for (const [name, route] of [["departments", "/departments"], ["papers", "/papers"], ["people", "/people"], ["login", "/login"]] as const) {
    await page.goto(route);
    await capture(page, testInfo.project.name, name);
  }
});

test("capture staff workspace surfaces", async ({ page }, testInfo) => {
  await loginAdmin(page);
  for (const [name, route] of [["workspace", "/workspace"], ["papers-datasets", "/workspace/submissions"], ["research-review", "/workspace/research"], ["people-accounts", "/workspace/users"]] as const) {
    await page.goto(route);
    await capture(page, testInfo.project.name, name);
  }
});
