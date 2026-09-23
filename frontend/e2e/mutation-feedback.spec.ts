import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const artifactDirectory = path.resolve(
  process.cwd(),
  "..",
  "verification",
  "browser-artifacts",
);
const browserOrigin = "http://127.0.0.1:3000";

test("partial settings save reloads server values and keeps the pending label", async ({
  page,
}) => {
  const verification = {
    archiveProject: "MANUAL",
    newDataset: "AUTOMATIC",
    newPaper: "AUTOMATIC",
    newProject: "MANUAL",
    profileEdit: "MANUAL",
    updateProject: "MANUAL",
  };
  const ranking = {
    leadCitationMinimum: 250,
    leadPaperMinimum: 8,
    seniorCitationMinimum: 100,
    seniorPaperMinimum: 4,
  };
  const notifications = {
    applicationAccepted: true,
    applicationRejected: true,
    deadlineDue: true,
    deadlineOverdue: true,
    deadlineReminder: true,
    milestoneProgress: true,
    reminderDays: 3,
    taskAssigned: true,
    taskChanged: true,
  };
  let savedVerification = { ...verification };
  let savedRanking = { ...ranking };
  let failedNotificationsWrite = false;
  let settingsReads = 0;

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const origin = request.headers().origin ?? browserOrigin;
    const headers = {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type,x-csrf-token",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-origin": origin,
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    const json = async (body: unknown, status = 200) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify(body),
      });

    if (url.pathname.endsWith("/auth/me")) {
      await json({
        csrfToken: "browser-test-token",
        user: {
          email: "admin@amirl.org",
          id: "admin-id",
          person: null,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });
      return;
    }
    if (url.pathname.endsWith("/notifications/count")) {
      await json({
        applications: 0,
        profileReviews: 0,
        projectReviews: 0,
        researchReviews: 0,
        weeklyReportReviews: 0,
        unreadCount: 0,
      });
      return;
    }
    if (url.pathname.endsWith("/settings/verification")) {
      if (request.method() === "PUT") {
        savedVerification = request.postDataJSON() as typeof verification;
        await json({ saved: true });
      } else {
        settingsReads += 1;
        await json(savedVerification);
      }
      return;
    }
    if (url.pathname.endsWith("/settings/ranking")) {
      if (request.method() === "PUT") {
        savedRanking = request.postDataJSON() as typeof ranking;
        await json({ saved: true });
      } else {
        await json(savedRanking);
      }
      return;
    }
    if (url.pathname.endsWith("/settings/notifications")) {
      if (request.method() === "PUT") {
        await new Promise((resolve) => setTimeout(resolve, 500));
        failedNotificationsWrite = true;
        await json({ message: "Simulated notification settings failure" }, 500);
      } else {
        await json(notifications);
      }
      return;
    }
    await json({});
  });

  await page.goto("/workspace/settings/verification");
  await expect(
    page.getByRole("heading", { name: "Content verification" }),
  ).toBeVisible();
  await mkdir(artifactDirectory, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDirectory, "mutation-feedback-before.png"),
  });

  const archivePolicy = page
    .locator("article")
    .filter({ hasText: "Project archiving" });
  await archivePolicy.getByRole("radio", { name: "Automatic" }).click();
  const save = page.getByRole("button", { name: "Save policy" });
  await save.click();
  await expect(save).toBeDisabled();
  await expect(save).toHaveText("Save policy");
  await expect(
    page
      .getByText(
        "Some settings were saved and others failed. The saved values are reloading.",
      )
      .first(),
  ).toBeVisible();
  await expect(save).toBeEnabled();
  await expect(archivePolicy).toContainText("Publishes directly");
  expect(failedNotificationsWrite).toBe(true);
  expect(settingsReads).toBeGreaterThan(1);
  expect(savedVerification.archiveProject).toBe("AUTOMATIC");

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: path.join(artifactDirectory, "mutation-feedback-after.png"),
  });
});
