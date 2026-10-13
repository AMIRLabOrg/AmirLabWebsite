import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ResearchItem } from "@/lib/types";
import { PaperCard } from "./paper-card";
import { ResearchCard } from "./research-card";

afterEach(cleanup);

const output: ResearchItem = {
  id: "output",
  slug: "output",
  title: "Research output",
  summary: "Research details",
  canonicalUrl: "https://doi.org/10.1234/example",
  legacyUrl: null,
  type: "PAPER",
  paper: null,
  dataset: null,
  project: null,
  contributors: [{ displayName: "Researcher", sortOrder: 0 }],
};

test.each(["PAPER", "DATASET"] as const)(
  "%s links the entire row to its source with a title icon and no secondary action",
  (type) => {
    const item = { ...output, type };
    const view = render(
      type === "PAPER" ? (
        <PaperCard item={item} />
      ) : (
        <ResearchCard item={item} variant="index" />
      ),
    );
    const row = screen.getByRole("link", { name: /Research output/ });
    expect(row.getAttribute("href")).toBe(item.canonicalUrl);
    expect(row.getAttribute("target")).toBe("_blank");
    expect(row.contains(screen.getByText("Researcher"))).toBe(true);
    expect(row.contains(screen.getByText("doi.org/10.1234/example"))).toBe(
      true,
    );
    expect(row.querySelector("strong svg[aria-hidden=true]")).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(view.container.querySelector("button")).toBeNull();
    expect(
      screen.queryByText(/Read paper|Open dataset|Click to expand/),
    ).toBeNull();
  },
);

test.each(["PAPER", "DATASET"] as const)(
  "%s without a source or during loading has no navigation action",
  (type) => {
    const item = { ...output, type, canonicalUrl: null };
    const view = render(<PaperCard item={item} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(view.container.querySelector("svg")).toBeNull();
    view.rerender(<PaperCard item={{ ...output, type }} loading />);
    expect(screen.queryByRole("link")).toBeNull();
  },
);
