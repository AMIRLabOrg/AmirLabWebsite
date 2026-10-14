import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OpenPositionsContent } from "./open-positions-content";
import type { Position } from "@/lib/types";
import { ApplicationForm } from "./application-form";
vi.mock("@/components/notification-provider", () => ({
  useNotifications: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/lib/resume-parser", () => ({ parseResumeFile: vi.fn() }));
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("disables recruitment consent while there are no positions", () => {
  render(
    <ApplicationForm positions={[]} positionId="" onPositionChange={vi.fn()} />,
  );
  expect(screen.getByRole("checkbox")).toBeDisabled();
  expect(screen.getByRole("checkbox").closest("label")).toHaveClass(
    "cursor-not-allowed",
  );
  expect(document.getElementById("cv")).toBeDisabled();
});

it("selects the clicked role in the application form without resetting other fields", () => {
  const positions: Position[] = ["Research fellow", "Research assistant"].map(
    (title, index) => ({
      id: `role-${index}`,
      slug: `role-${index}`,
      title,
      summary: "Join the lab",
      description: null,
      responsibilities: [],
      requirements: [],
      positionType: "OTHER",
      status: "OPEN",
      deadline: null,
      opensAt: null,
      closesAt: null,
      engagementType: "FLEXIBLE",
      engagementStartsAt: null,
      engagementEndsAt: null,
      engagementDurationLabel: null,
      weeklyCommitmentHours: null,
      targetRank: null,
      department: null,
    }),
  );
  render(<OpenPositionsContent positions={positions} />);
  fireEvent.click(screen.getByRole("checkbox"));
  const apply = screen.getByRole("link", {
    name: "Apply for Research assistant",
  });
  expect(apply).toHaveAttribute("href", "#apply");
  fireEvent.click(apply);
  expect(screen.getByRole("combobox", { name: "Position" })).toHaveTextContent(
    "Research assistant",
  );
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("link", { name: "Research fellow" }));
  expect(screen.getByRole("combobox", { name: "Position" })).toHaveTextContent(
    "Research fellow",
  );
  expect(screen.getByRole("checkbox")).toBeChecked();
});
