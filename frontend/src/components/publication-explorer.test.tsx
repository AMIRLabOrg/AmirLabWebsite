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
  search: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => {
    if (mocks.suspended) throw new Promise(() => {});
    return new URLSearchParams(mocks.search);
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
  mocks.search = "";
  vi.clearAllMocks();
});

test("distinguishes an empty catalogue from a filtered catalogue", async () => {
  const empty: PublicationResponse = { ...seed, items: [], total: 0 };
  const view = render(<PublicationExplorer initialData={empty} />);
  expect(
    screen.getByRole("heading", { name: "No publications yet" }),
  ).toBeTruthy();
  view.rerender(
    <PublicationExplorer
      initialData={{
        ...empty,
        facets: {
          categories: [{ value: "JOURNAL", label: "Journal", count: 1 }],
          years: [],
        },
      }}
    />,
  );
  await waitFor(() =>
    expect(
      screen.getByRole("heading", {
        name: "No publications match these filters",
      }),
    ).toBeTruthy(),
  );
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
  await waitFor(() => expect(window.location.search).toContain("pageSize=12"));
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
  const input = screen.getByPlaceholderText(
    "Search title, author, venue, or DOI",
  );
  input.focus();
  fireEvent.change(input, { target: { value: "query" } });
  expect(mocks.request).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(document.activeElement).toBe(input);
  expect(input.hasAttribute("disabled")).toBe(false);
  expect(
    screen
      .getByRole("region", { name: "Publication archive" })
      .getAttribute("aria-busy"),
  ).toBe("true");
  await waitFor(() => expect(screen.getByText("Search result")).toBeTruthy());
  expect(mocks.request.mock.calls[0][0]).toContain("search=query");
  expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();
  fireEvent.click(
    screen.getByRole("button", { name: "Clear search publications" }),
  );
  expect(screen.getByText("Cached publication")).toBeTruthy();
  await waitFor(() =>
    expect(window.location.search).toBe("?page=1&pageSize=12&sort=NEWEST"),
  );
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

test("fresh server props do not replace an already matching papers URL", async () => {
  mocks.search = "page=1&pageSize=12&sort=NEWEST";
  const view = render(<PublicationExplorer initialData={seed} />);
  await new Promise((resolve) => setTimeout(resolve, 350));
  view.rerender(
    <PublicationExplorer
      initialData={{
        ...seed,
        items: [{ ...seed.items[0], title: "Fresh cached result" }],
      }}
    />,
  );
  await new Promise((resolve) => setTimeout(resolve, 350));
  expect(mocks.replace).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
  expect(screen.getByText("Fresh cached result")).toBeTruthy();
});

test("failed refresh retains loaded controls, focus, counts and previous publications", async () => {
  mocks.request.mockRejectedValue(new Error("Network unavailable"));
  render(<PublicationExplorer initialData={seed} />);
  const input = screen.getByRole("searchbox");
  input.focus();
  fireEvent.change(input, { target: { value: "new search" } });
  fireEvent.keyDown(input, { key: "Enter" });
  await screen.findByRole("alert");
  expect(screen.getByText("Cached publication")).toBeTruthy();
  expect(document.activeElement).toBe(input);
  expect(input.hasAttribute("disabled")).toBe(false);
  expect(screen.getByText("1 results")).toBeTruthy();
});

test("retry after an initial failure preserves the now-visible search field", async () => {
  mocks.request.mockRejectedValueOnce(new Error("Initial connection failed"));
  render(<PublicationExplorer />);
  await screen.findByText("Initial connection failed");
  mocks.request.mockReturnValue(new Promise(() => {}));
  const input = screen.getByRole("searchbox");
  input.focus();
  fireEvent.change(input, { target: { value: "retry" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(input.hasAttribute("disabled")).toBe(false);
  expect(document.activeElement).toBe(input);
  expect(screen.getByText("Results unavailable")).toBeTruthy();
});
