import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ApplicationForm } from "./application-form";
vi.mock("@/components/notification-provider", () => ({
  useNotifications: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/lib/resume-parser", () => ({ parseResumeFile: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("disables recruitment consent while there are no positions", () => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  render(<ApplicationForm positions={[]} />);
  expect(screen.getByRole("checkbox")).toBeDisabled();
});
