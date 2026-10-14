import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResearchConnectionsPanel } from "./research-connections-panel";
import { apiRequest } from "@/lib/client-api";
vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({ loading: false, user: { id: "member", role: "MEMBER" } }),
}));
vi.mock("@/components/notification-provider", () => ({
  useNotifications: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/lib/client-api", async (original) => ({
  ...(await original<typeof import("@/lib/client-api")>()),
  apiRequest: vi.fn(),
}));
afterEach(cleanup);
it("searches connections on Enter and preserves the focused field after failure", async () => {
  const request = vi.mocked(apiRequest);
  request.mockImplementation(async (path) => {
    if (path === "/research-connections/mine")
      return { connections: [], requests: [] };
    throw new Error("Search failed");
  });
  render(<ResearchConnectionsPanel />);
  const search = screen.getByRole("searchbox");
  await waitFor(() => expect(search).toBeEnabled());
  search.focus();
  fireEvent.change(search, { target: { value: "author" } });
  expect(request.mock.calls.some(([path]) => path.includes("/search?"))).toBe(
    false,
  );
  fireEvent.keyDown(search, { key: "Enter" });
  await waitFor(() =>
    expect(
      request.mock.calls.some(
        ([path]) => path === "/research-connections/search?query=author",
      ),
    ).toBe(true),
  );
  await screen.findByText("Search failed");
  expect(search).toHaveFocus();
  expect(search).not.toHaveAttribute("data-placeholder");
});

it("clear applies empty immediately and ignores an older lookup failure", async () => {
  const request = vi.mocked(apiRequest);
  let reject: (error: Error) => void = () => {};
  const pending = new Promise((_, fail) => {
    reject = fail;
  });
  request.mockImplementation(async (path) =>
    path === "/research-connections/mine"
      ? { connections: [], requests: [] }
      : pending,
  );
  render(<ResearchConnectionsPanel />);
  const search = screen.getByRole("searchbox");
  await waitFor(() => expect(search).toBeEnabled());
  fireEvent.change(search, { target: { value: "author" } });
  fireEvent.keyDown(search, { key: "Enter" });
  fireEvent.click(
    screen.getByRole("button", {
      name: "Clear find a published output to claim",
    }),
  );
  expect(search).toHaveValue("");
  expect(search).toHaveFocus();
  await act(async () => {
    reject(new Error("Stale failure"));
  });
  expect(screen.queryByText("Stale failure")).not.toBeInTheDocument();
});
