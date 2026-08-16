import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const globals = read("src/app/globals.css");
const brand = read("src/components/brand-mark.tsx");
const review = read("src/components/research-review-queue.tsx");
const login = read("src/components/login-form.tsx");
const reset = read("src/components/reset-password-form.tsx");
const layout = read("src/app/layout.tsx");

expect(
  fs.existsSync(path.join(root, "public/amirlab-wordmark.png")),
  "Self-contained AMIRLab wordmark asset is missing.",
);
expect(
  brand.includes("/amirlab-wordmark.png"),
  "Brand lockup must use the approved self-contained wordmark asset.",
);
expect(
  !globals.includes("ff-mab.regular.ttf"),
  "Runtime CSS must not depend on an external FF MAB font file.",
);
expect(
  !layout.includes("ff-mab.regular.ttf"),
  "Root layout must not preload an external FF MAB font file.",
);
expect(
  brand.includes('aria-label="AmirLab"'),
  "Brand lockup must have an accessible AmirLab name.",
);

expect(
  review.includes('pageSize: "10"'),
  "Research review queue must use 10 records per page.",
);
expect(
  (review.match(/sticky top-\[88px\]/g) ?? []).length >= 2,
  "Both review queue and detail panes must stay sticky on desktop.",
);
expect(
  review.includes("overflow-y-auto"),
  "Review queue/detail panes must scroll internally.",
);
expect(
  review.includes("<SearchableSelect"),
  "Every contributor relationship must use the searchable registered-person selector.",
);
expect(
  review.includes("100)}% match"),
  "Contributor match confidence must be visible as a percentage.",
);
expect(
  review.includes("selectedIsSuggestion ? selectedMatch : undefined"),
  "Reject must apply to the currently selected proposed match.",
);
expect(
  review.includes('selectedMatch?.status === "PROPOSED"'),
  "A preselected automatic match must be verified as the existing proposal, not rewritten as a manual link.",
);
expect(
  review.includes(
    "verifyContributor(item.id, contributor.sortOrder, selectedPersonId, selectedMatch)",
  ),
  "Verify must act on the currently selected searchable-person value.",
);
expect(
  !review.includes("One-token overlap"),
  "Weak one-token candidate pills must not return.",
);
expect(
  review.includes("disabled={sourcePending || !item.canonicalUrl}"),
  "Source check must be disabled without a canonical URL.",
);
expect(
  review.includes("No canonical source URL was submitted"),
  "Missing canonical source must have a clear manual-review state.",
);
expect(
  review.includes("The canonical source has not been checked yet."),
  "Unchecked sources must not be mislabeled as missing metadata.",
);

expect(
  login.includes("/forgot-password"),
  "Login page must expose password recovery.",
);
expect(
  reset.includes("/auth/password-reset/complete"),
  "Reset-password form must call the completion endpoint.",
);
expect(
  reset.includes("window.location.hash"),
  "Reset password must read its one-time token from the URL fragment.",
);
expect(
  reset.includes("window.history.replaceState"),
  "Reset token should be removed from browser history after the page receives it.",
);
expect(
  !reset.includes("caught.message"),
  "Password reset must not render raw exception messages.",
);
expect(
  fs.existsSync(path.join(root, "src/app/forgot-password/page.tsx")),
  "Forgot-password page is missing.",
);
expect(
  fs.existsSync(path.join(root, "src/app/reset-password/page.tsx")),
  "Reset-password page is missing.",
);

if (failures.length) {
  console.error("Brand/review-layout verification failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "Brand asset, contributor review, source review, sticky layout, and recovery UI contracts verified.",
);
