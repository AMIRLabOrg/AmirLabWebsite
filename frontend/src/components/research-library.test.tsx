import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResearchLibrary } from "./research-library";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), request: vi.fn() }));
vi.mock("@/lib/client-api", () => ({ apiRequest: mocks.request }));
vi.mock("@/components/auth-provider", () => ({ useAuth: mocks.auth }));
vi.mock("@/components/paper-card", () => ({
  PaperCard: ({ item }: { item?: { title: string } }) => (
    <article>{item?.title ?? "Loading output"}</article>
  ),
}));

const response = {
  items: [{ id: "paper", title: "Source paper" }],
  page: 1,
  pageSize: 20,
  total: 1,
  totalPages: 1,
};

describe("ResearchLibrary", () => {
  beforeEach(() => {
    mocks.request.mockReset().mockResolvedValue(response);
    mocks.auth.mockReturnValue({
      loading: false,
      user: { id: "member", role: "MEMBER" },
    });
  });

  afterEach(cleanup);

  it("shows a readonly member library without staff views", async () => {
    render(<ResearchLibrary />);

    expect(await screen.findByText("Source paper")).toBeTruthy();
    expect(
      screen.getByRole("combobox", { name: "Research output type" })
        .textContent,
    ).toContain("All outputs");
    expect(screen.queryByLabelText("Library view")).toBeNull();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.stringContaining("view=current"),
      { method: "GET" },
    );
  });

  it("lets staff page and select retained history", async () => {
    mocks.auth.mockReturnValue({
      loading: false,
      user: { id: "admin", role: "ADMIN" },
    });
    render(<ResearchLibrary />);

    fireEvent.click(await screen.findByLabelText("Library view"));
    fireEvent.click(screen.getByRole("option", { name: "Link history" }));
    await waitFor(() =>
      expect(mocks.request).toHaveBeenCalledWith(
        expect.stringContaining("view=retained"),
        { method: "GET" },
      ),
    );
    expect(screen.getByRole("status").textContent).toContain(
      "Previously published works with an inactive person link",
    );
  });
});
