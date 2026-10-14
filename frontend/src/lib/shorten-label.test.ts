import { expect, test } from "vitest";
import { shortenLabel } from "./shorten-label";

test("keeps short labels and caps long labels including the ellipsis", () => {
  expect(shortenLabel("OpenAlex")).toBe("OpenAlex");
  expect(shortenLabel("x".repeat(40))).toBe("x".repeat(40));
  expect(shortenLabel("x".repeat(41))).toBe(`${"x".repeat(39)}…`);
  expect(shortenLabel("🔬".repeat(41))).toBe(`${"🔬".repeat(39)}…`);
});
