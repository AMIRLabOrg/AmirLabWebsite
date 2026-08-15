import { expect, test, type Page } from "@playwright/test";

const publicRoutes = [
  "/", "/about", "/people", "/departments", "/papers", "/datasets", "/projects", "/open-positions", "/login", "/auth/setup",
];

const staffRoutes = [
  "/workspace",
  "/workspace/chat",
  "/workspace/notifications",
  "/workspace/profile",
  "/workspace/programs",
  "/workspace/projects",
  "/workspace/projects/new",
  "/workspace/submissions",
  "/workspace/submissions/new",
  "/workspace/profile-reviews",
  "/workspace/research",
  "/workspace/project-reviews",
  "/workspace/weekly-reports/review",
  "/workspace/users",
  "/workspace/departments",
  "/workspace/departments/new",
  "/workspace/positions",
  "/workspace/positions/new",
  "/workspace/applications",
  "/workspace/universities",
  "/workspace/universities/new",
  "/workspace/settings/verification",
  "/workspace/content",
  "/workspace/users/new",
];

async function noHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth, `horizontal overflow: ${dimensions.scrollWidth} > ${dimensions.clientWidth}`).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function loginAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.AMIRLAB_E2E_ADMIN_EMAIL ?? "admin@amirl.local");
  await page.getByLabel("Password").fill(process.env.AMIRLAB_E2E_ADMIN_PASSWORD ?? "AmirlabLocal2026!");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/workspace(?:$|\/)/);
}

test.describe("public routes", () => {
  for (const route of publicRoutes) {
    test(`${route} renders without overflow`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await noHorizontalOverflow(page);
    });
  }


  test("public dynamic record routes render", async ({ page }) => {
    for (const [indexRoute, pattern] of [["/people", /^\/people\/[^/]+$/], ["/departments", /^\/departments\/[^/]+$/], ["/projects", /^\/projects\/[^/]+$/]] as const) {
      await page.goto(indexRoute);
      const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""));
      const href = hrefs.find((candidate) => pattern.test(candidate));
      if (!href) continue;
      const response = await page.goto(href);
      expect(response?.status() ?? 200).toBeLessThan(500);
      await noHorizontalOverflow(page);
    }
  });

  test("public account avatar uses the shared square avatar geometry", async ({ page }) => {
    await page.goto("/");
    const avatar = page.locator('[data-profile-avatar="true"]').first();
    if (await avatar.count()) {
      const radius = await avatar.evaluate((node) => getComputedStyle(node).borderRadius);
      expect(parseFloat(radius)).toBeLessThanOrEqual(6);
    }
  });
});

test.describe("admin workspace", () => {
  test.beforeEach(async ({ page }) => loginAdmin(page));

  test("staff navigation respects role boundaries", async ({ page }) => {
    await expect(page.getByText("Papers & datasets review", { exact: true })).toBeVisible();
    await expect(page.getByText("Weekly report reviews", { exact: true })).toBeVisible();
    await expect(page.getByText("My tasks", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Weekly reports", { exact: true })).toHaveCount(0);
  });

  test("member-only pages reject admin navigation", async ({ page }) => {
    await page.goto("/workspace/tasks");
    await page.waitForURL(/\/workspace\/?$/);
    await page.goto("/workspace/weekly-reports");
    await page.waitForURL(/\/workspace\/?$/);
  });

  for (const route of staffRoutes) {
    test(`${route} renders without overflow`, async ({ page }) => {
      const response = await page.goto(route);
      expect(response?.status() ?? 200).toBeLessThan(500);
      await expect(page.locator("body")).toBeVisible();
      await noHorizontalOverflow(page);
    });
  }


  test("dynamic management routes render when seeded records exist", async ({ page }) => {
    const probes = [
      ["/workspace/applications", /^\/workspace\/applications\/[^/]+$/],
      ["/workspace/content", /^\/workspace\/content\/[^/]+$/],
      ["/workspace/departments", /^\/workspace\/departments\/[^/]+$/],
      ["/workspace/positions", /^\/workspace\/positions\/[^/]+$/],
      ["/workspace/profile-reviews", /^\/workspace\/profile-reviews\/[^/]+$/],
      ["/workspace/projects", /^\/workspace\/projects\/[^/]+$/],
      ["/workspace/research", /^\/workspace\/research\/[^/]+$/],
      ["/workspace/universities", /^\/workspace\/universities\/[^/]+$/],
      ["/workspace/users", /^\/workspace\/users\/[^/]+\/edit$/],
    ] as const;
    for (const [indexRoute, pattern] of probes) {
      await page.goto(indexRoute);
      const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute("href") || ""));
      const href = hrefs.find((candidate) => pattern.test(candidate) && !candidate.endsWith("/new"));
      if (!href) continue;
      const response = await page.goto(href);
      expect(response?.status() ?? 200).toBeLessThan(500);
      await noHorizontalOverflow(page);
    }
  });

  test("workspace avatar is square and shares canonical component marker", async ({ page }) => {
    await page.goto("/workspace");
    const avatar = page.locator('[data-profile-avatar="true"]').first();
    await expect(avatar).toBeVisible();
    const metrics = await avatar.evaluate((node) => {
      const css = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return { radius: parseFloat(css.borderRadius), width: rect.width, height: rect.height };
    });
    expect(metrics.radius).toBeLessThanOrEqual(6);
    expect(Math.abs(metrics.width - metrics.height)).toBeLessThanOrEqual(1);
  });

  test("rebuilt people and papers are visible to internal management", async ({ page }) => {
    await page.goto("/workspace/users");
    await expect(page.getByText(/setup pending/i).first()).toBeVisible();
    await page.goto("/workspace/research");
    await expect(page.getByText(/review queue/i)).toBeVisible();
    await expect(page.getByText(/paper/i).first()).toBeVisible();
  });

  test("reviewed research remains manageable", async ({ page }) => {
    await page.goto("/workspace/research");
    const record = page.locator("aside button").first();
    if (await record.count()) {
      await record.click();
      await expect(page.getByRole("button", { name: /edit record/i })).toBeVisible();
    }
  });
});
