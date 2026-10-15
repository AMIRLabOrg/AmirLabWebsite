import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { WorkspaceRecordRowHeading } from "./workspace-record";

afterEach(cleanup);

it("exposes section, subsection, and entry as a descending heading hierarchy", () => {
  render(
    <>
      <WorkspaceRecordRowHeading
        level="section"
        number="01"
        title="Education"
      />
      <WorkspaceRecordRowHeading
        level="subsection"
        number="1.1"
        title="University"
      />
      <WorkspaceRecordRowHeading
        level="entry"
        number="1.1.1"
        title="Computer science"
      />
    </>,
  );
  expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
    "Education",
  );
  expect(screen.getByRole("heading", { level: 4 }).textContent).toBe(
    "University",
  );
  expect(screen.getByRole("heading", { level: 5 }).textContent).toBe(
    "Computer science",
  );
  expect(screen.getByText("subsection 1.1")).toBeTruthy();
  expect(screen.getByText("entry 1.1.1")).toBeTruthy();
});
