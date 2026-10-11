import { afterEach, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { PublicationResponse } from "@/lib/types";
import { PublicationExplorer } from "./publication-explorer";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  replace: vi.fn(),
  suspended: false,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => {
    if (mocks.suspended) throw new Promise(() => {});
    return new URLSearchParams();
  },
}));
vi.mock("@/lib/client-api", () => ({ apiRequest: mocks.request }));
vi.mock("@/components/paper-card", () => ({
  PaperCard: ({ item }: { item?: { title: string } }) => (
    <article>{item?.title ?? "Pending paper"}</article>
  ),
}));
const seed: PublicationResponse = {
  items: [
    {
      id: "seed",
      slug: "seed",
      title: "Cached publication",
      summary: null,
      canonicalUrl: null,
      legacyUrl: null,
      type: "PAPER",
      paper: null,
      dataset: null,
      project: null,
      contributors: [],
    },
  ],
  page: 1,
  pageSize: 12,
  total: 1,
  totalPages: 1,
  facets: { categories: [], years: [] },
};
afterEach(() => {
  cleanup();
  mocks.suspended = false;
  vi.clearAllMocks();
});

test("server fallback renders cached publications when URL hooks suspend", () => {
  mocks.suspended = true;
  expect(renderToString(<PublicationExplorer initialData={seed} />)).toContain(
    "<article>Cached publication</article>",
  );
});

test("initial cached result is visible without a client request and refresh props update it", async () => {
  const view = render(<PublicationExplorer initialData={seed} />);
  expect(screen.getByText("Cached publication")).toBeTruthy();
  await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  expect(mocks.request).not.toHaveBeenCalled();
  view.rerender(
    <PublicationExplorer
      initialData={{
        ...seed,
        items: [{ ...seed.items[0], title: "Updated publication" }],
      }}
    />,
  );
  expect(screen.getByText("Updated publication")).toBeTruthy();
  expect(mocks.request).not.toHaveBeenCalled();
});

test("filter requests retain pending UI then display their result", async () => {
  mocks.request.mockResolvedValue({
    ...seed,
    items: [{ ...seed.items[0], title: "Search result" }],
  });
  render(<PublicationExplorer initialData={seed} />);
  fireEvent.change(
    screen.getByPlaceholderText("Search title, author, venue, or DOI"),
    { target: { value: "query" } },
  );
  expect(
    screen
      .getByRole("region", { name: "Publication archive" })
      .getAttribute("aria-busy"),
  ).toBe("true");
  await waitFor(() => expect(screen.getByText("Search result")).toBeTruthy());
  expect(mocks.request.mock.calls[0][0]).toContain("search=query");
  fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
  expect(screen.getByText("Cached publication")).toBeTruthy();
  await waitFor(() =>
    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/papers?page=1&pageSize=12&sort=NEWEST",
      { scroll: false },
    ),
  );
  expect(mocks.request).toHaveBeenCalledTimes(1);
});
