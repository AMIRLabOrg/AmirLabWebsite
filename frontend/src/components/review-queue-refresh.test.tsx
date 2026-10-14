import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ApplicationReviewQueue } from "./application-review-queue";
import { ProfileReviewQueue } from "./profile-review-queue";
import { UserManagement } from "./user-management";
import { ProjectReviewQueue } from "./project-review-queue";
import { apiRequest } from "@/lib/client-api";
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ user: { id: "admin", role: "ADMIN" } }),
}));
vi.mock("@/components/notification-provider", () => ({
  useNotifications: () => ({
    refreshUnreadCount: vi.fn(async () => {}),
    showToast: vi.fn(),
  }),
}));
vi.mock("@/lib/use-review-selection", () => ({
  useReviewSelection: () => ({ select: vi.fn() }),
}));
vi.mock("./confirm-dialog", () => ({
  ConfirmDialog: ({
    open,
    onConfirm,
    confirmLabel,
  }: {
    open: boolean;
    onConfirm: () => void;
    confirmLabel: string;
  }) => (open ? <button onClick={onConfirm}>{confirmLabel}</button> : null),
}));
vi.mock("./application-review-detail", () => ({
  ApplicationReviewDetail: () => null,
}));
vi.mock("./profile-review-detail", () => ({ ProfileReviewDetail: () => null }));
vi.mock("@/lib/client-api", async (original) => ({
  ...(await original<typeof import("@/lib/client-api")>()),
  apiRequest: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(apiRequest).mockReset();
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
it.each([
  ["applications", ApplicationReviewQueue],
  ["profiles", ProfileReviewQueue],
] as const)(
  "keeps search and known navigation after empty results and refresh failure: %s",
  async (_, Queue) => {
    const request = vi.mocked(apiRequest);
    request.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
    render(<Queue />);
    await screen.findByText("0-0 of 0");
    const pager = screen.getByRole("navigation", { name: "Pagination" });
    const search = screen.getByRole("searchbox");
    search.focus();
    fireEvent.change(search, { target: { value: "author" } });
    expect(request).toHaveBeenCalledTimes(1);
    request.mockRejectedValueOnce(new Error("Refresh failed"));
    fireEvent.keyDown(search, { key: "Enter" });
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    await screen.findByText("Refresh failed");
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBe(pager);
    expect(search).toHaveFocus();
    expect(search).toHaveValue("author");
    expect(pager).not.toHaveAttribute("data-loading");
  },
);

it("preserves known account count and email while search refresh fails", async () => {
  const request = vi.mocked(apiRequest);
  request.mockResolvedValueOnce({
    items: [
      {
        id: "one",
        email: "member@example.test",
        role: "MEMBER",
        status: "ACTIVE",
        isDeleted: false,
        deletedAt: null,
        setupEmailQueuedAt: null,
        person: {
          id: "person",
          fullName: "Member",
          rank: null,
          slug: "member",
          isPublished: true,
        },
      },
    ],
    page: 1,
    pageSize: 20,
    total: 1,
    totalPages: 1,
  });
  render(<UserManagement />);
  const count = await screen.findByText("1 account");
  const search = screen.getByRole("searchbox");
  search.focus();
  fireEvent.change(search, { target: { value: "author" } });
  expect(request).toHaveBeenCalledTimes(1);
  request.mockRejectedValueOnce(new Error("Refresh failed"));
  fireEvent.keyDown(search, { key: "Enter" });
  expect(count.parentElement).not.toHaveAttribute("data-loading");
  expect(screen.getByText("member@example.test")).toBeVisible();
  await screen.findByText("Refresh failed");
  expect(screen.getByText("1 account")).toBe(count);
  expect(search).toHaveFocus();
});

it("retains loaded project rows and count after a saved review fails to refresh", async () => {
  const request = vi.mocked(apiRequest);
  request.mockResolvedValueOnce([
    {
      id: "change",
      projectId: "project",
      kind: "SETTINGS",
      payload: {},
      submittedAt: "2026-10-14T00:00:00Z",
      submittedById: "member",
      submittedBy: {
        email: "member@example.test",
        person: { fullName: "Member" },
      },
      project: { researchItem: { title: "Existing project" } },
    },
  ]);
  render(<ProjectReviewQueue />);
  const title = await screen.findByText("Existing project");
  request
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error("Refresh failed"));
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  fireEvent.click(screen.getByRole("button", { name: "Approve change" }));
  await screen.findByText(
    "The review decision was saved, but the queue could not refresh.",
  );
  expect(screen.getByText("Existing project")).toBe(title);
  expect(screen.getByText("1 pending")).not.toHaveAttribute("data-placeholder");
});
