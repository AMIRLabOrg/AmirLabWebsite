import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkersMonitor } from "./workers-monitor";

const apiRequest = vi.fn();
vi.mock("@/lib/client-api", () => ({
  apiRequest: (...args: unknown[]) => apiRequest(...args),
}));
vi.mock("@/components/admin-only", () => ({
  AdminOnly: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/notification-provider", () => ({
  useNotifications: () => ({
    subscribeJobEvents: () => () => undefined,
    showToast: vi.fn(),
  }),
}));

function row(id: string, type: string) {
  return {
    id,
    type,
    status: "SUCCEEDED",
    attempts: 1,
    maxAttempts: 5,
    subject: id,
    lastError: null,
    runAt: "2026-10-12T10:00:00.000Z",
    lockedAt: null,
    completedAt: null,
    cancelRequestedAt: null,
    createdAt: "2026-10-12T10:00:00.000Z",
    updatedAt: "2026-10-12T10:00:00.000Z",
  };
}

describe("WorkersMonitor", () => {
  afterEach(cleanup);
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
    apiRequest.mockReset().mockImplementation((path: string) => {
      if (path === "/admin/jobs/summary")
        return Promise.resolve({
          statuses: {
            PENDING: 0,
            RUNNING: 0,
            SUCCEEDED: 51,
            FAILED: 0,
            CANCELLED: 0,
          },
          types: [
            { type: "SYNC_OPENALEX_AUTHOR", status: "SUCCEEDED", count: 1 },
            { type: "HISTORIC_TASK", status: "SUCCEEDED", count: 50 },
          ],
          registeredTypes: ["REGISTERED_NO_RUN"],
          succeeded24h: 51,
          failed24h: 0,
        });
      if (path === "/backups/status")
        return Promise.resolve({
          busy: false,
          configured: false,
          reason: null,
          lastBackup: null,
        });
      const page = new URLSearchParams(path.split("?")[1]).get("page");
      return Promise.resolve({
        page: Number(page),
        pageSize: 50,
        total: 51,
        totalPages: 2,
        items:
          page === "2"
            ? [row("job-51", "SYNC_OPENALEX_AUTHOR")]
            : [
                row("job-1", "SYNC_OPENALEX_AUTHOR"),
                row("job-2", "HISTORIC_TASK"),
              ],
      });
    });
  });

  it("shows all and historical types, groups runs, and pages the queue", async () => {
    render(<WorkersMonitor />);

    fireEvent.click(
      screen.getByRole("combobox", { name: "Filter by job type" }),
    );
    expect(
      await screen.findByRole("option", { name: "All types" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("option", { name: "Purge deleted accounts" }),
    ).toBeNull();
    expect(
      (await screen.findAllByText("Historic task")).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("option", { name: "All types" }));
    const group = await screen.findByRole("button", {
      name: /OpenAlex author sync/,
    });
    expect(group.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(group);
    expect(await screen.findByText("job-1")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("combobox", { name: "Filter by job type" }),
    );
    expect(
      await screen.findByRole("option", { name: "Registered no run" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: "All types" }));
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() =>
      expect(apiRequest).toHaveBeenCalledWith(
        expect.stringContaining("page=2"),
        expect.anything(),
      ),
    );
  });
  it("keeps known metrics and pagination mounted during refresh and empty responses", async () => {
    render(<WorkersMonitor />);
    await screen.findByText("1-50 of 51");
    const pager = screen.getByRole("navigation", { name: "Pagination" });
    const count = screen.getByText("51");
    let finish: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    apiRequest.mockImplementation((path: string) => {
      if (path === "/admin/jobs/summary")
        return Promise.resolve({
          statuses: {},
          types: [],
          registeredTypes: [],
          succeeded24h: 51,
          failed24h: 0,
        });
      if (path === "/backups/status") return Promise.resolve(null);
      return pending;
    });
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(count).toBeVisible();
    expect(count).not.toHaveAttribute("data-placeholder");
    await act(async () => {
      finish({ items: [], page: 2, pageSize: 50, total: 0, totalPages: 0 });
    });
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBe(pager);
    expect(await screen.findByText("No background jobs")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(screen.getByRole("button", { name: "Refresh" })).not.toHaveAttribute(
      "data-placeholder",
    );
  });
});
