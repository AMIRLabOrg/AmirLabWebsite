import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { PersonPortrait } from "./person-portrait";

afterEach(cleanup);

it("uses small initials when no portrait exists", () => {
  const { container } = render(
    <PersonPortrait
      person={{ fullName: "no photo", avatar: null }}
      variant="small"
    />,
  );
  expect(screen.getByText("NP")).toBeTruthy();
  expect(container.querySelector("img")).toBeNull();
  expect(container.firstElementChild?.classList.contains("size-8")).toBe(true);
});

it("falls back to initials after a broken image and retries when the image changes", () => {
  const view = render(
    <PersonPortrait
      person={{ fullName: "Lab Member", avatar: { id: "missing" } }}
      variant="small"
    />,
  );
  fireEvent.error(view.container.querySelector("img")!);
  expect(screen.getByText("LM")).toBeTruthy();
  expect(view.container.querySelector("img")).toBeNull();
  view.rerender(
    <PersonPortrait
      person={{ fullName: "Lab Member", avatar: { id: "replacement" } }}
      variant="small"
    />,
  );
  expect(view.container.querySelector("img")?.getAttribute("sizes")).toBe(
    "32px",
  );
});
