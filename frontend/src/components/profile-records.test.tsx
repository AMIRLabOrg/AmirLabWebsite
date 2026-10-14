import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ProfileRecords } from "./profile-records";
afterEach(cleanup);
it("filters profile records only after Enter and retains the search field", () => {
  render(
    <ProfileRecords
      records={[
        {
          id: "history",
          title: "History",
          type: "OTHER",
          entryCount: 13,
          blocks: [
            {
              heading: null,
              entries: Array.from({ length: 13 }, (_, index) => ({
                label: null,
                content: index === 0 ? "Target entry" : `Record ${index}`,
              })),
            },
          ],
        },
      ]}
    />,
  );
  const search = screen.getByRole("searchbox");
  search.focus();
  fireEvent.change(search, { target: { value: "Target" } });
  expect(screen.getByText("Record 1")).toBeInTheDocument();
  fireEvent.keyDown(search, { key: "Enter" });
  expect(screen.queryByText("Record 1")).not.toBeInTheDocument();
  expect(screen.getByText("Target entry")).toBeInTheDocument();
  expect(search).toHaveFocus();
  fireEvent.change(search, { target: { value: "missing" } });
  fireEvent.keyDown(search, { key: "Enter" });
  expect(screen.getByRole("searchbox")).toBe(search);
});
