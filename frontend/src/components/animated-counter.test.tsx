import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { AnimatedCounter } from "./animated-counter";

afterEach(cleanup);

it("renders animated digits on the server without waiting for hydration", () => {
  const html = renderToStaticMarkup(<AnimatedCounter value={1234} />);
  expect(html).toContain("counter-roll");
  expect(html).toContain('class="sr-only">1,234');
  expect(html).toContain("motion-reduce:animate-none");
});

it("keeps separators static and exposes one exact accessible total", () => {
  const { container } = render(<AnimatedCounter value={1234} />);
  expect(screen.getByText("1,234").className).toBe("sr-only");
  expect(container.querySelectorAll("[data-counter-digit]")).toHaveLength(4);
  expect(
    container.querySelector('[aria-hidden="true"]')?.textContent,
  ).toContain(",");
});
