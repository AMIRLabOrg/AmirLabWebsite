import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ButtonControl } from "./button-control";

afterEach(cleanup);
test("a pending action retains its label and prevents duplicate submission", () => {
  const view = render(<ButtonControl>Save settings</ButtonControl>);
  const button = screen.getByRole("button", { name: "Save settings" });
  view.rerender(<ButtonControl busy>Save settings</ButtonControl>);
  expect(screen.getByRole("button", { name: "Save settings" })).toBe(button);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(button.hasAttribute("data-placeholder")).toBe(false);
});
test("initial placeholders remain available before data has loaded", () => {
  render(<ButtonControl loading>Save settings</ButtonControl>);
  expect(screen.getByRole("button").getAttribute("data-placeholder")).toBe(
    "control",
  );
});
