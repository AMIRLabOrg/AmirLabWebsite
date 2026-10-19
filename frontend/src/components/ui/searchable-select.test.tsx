import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SearchableSelect } from "./searchable-select";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

it("shows portraits and missing-photo initials in people options and the selected value", () => {
  render(
    <SearchableSelect
      ariaLabel="Person"
      onValueChange={() => {}}
      value="photo"
      options={[
        { value: "photo", label: "With Photo", avatar: { id: "portrait" } },
        { value: "empty", label: "No Photo", avatar: null },
        { value: "external", label: "External record" },
      ]}
    />,
  );
  expect(
    screen.getByRole("button", { name: "Person" }).querySelector("img"),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Person" }));
  expect(
    screen.getByRole("option", { name: "With Photo" }).querySelector("img"),
  ).toBeTruthy();
  expect(
    within(screen.getByRole("option", { name: "No Photo" })).getByText("NP"),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("option", { name: "External record" })
      .querySelector('[aria-hidden="true"]'),
  ).toBeNull();
});
