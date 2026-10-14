import { afterEach, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { ToolbarSearchField } from "./toolbar-search-field";

const policy = vi.hoisted(() => ({ delay: null as number | null }));
vi.mock("@/lib/search-policy", () => ({
  get SEARCH_DEBOUNCE_MS() {
    return policy.delay;
  },
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  policy.delay = null;
});
function Field({ submit }: { submit: () => void }) {
  const [value, setValue] = useState("");
  return (
    <ToolbarSearchField
      id="test-search"
      label="Search"
      placeholder="Search"
      value={value}
      onValueChange={setValue}
      onSearch={submit}
    />
  );
}
test("typing waits for Enter and IME Enter does not submit", () => {
  const submit = vi.fn();
  render(<Field submit={submit} />);
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "papers" } });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter", isComposing: true });
  expect(submit).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: "Enter" });
  expect(submit).toHaveBeenCalledTimes(1);
});
test("one policy enables trailing debounce without submitting on initial load", () => {
  policy.delay = 300;
  vi.useFakeTimers();
  const submit = vi.fn();
  render(<Field submit={submit} />);
  vi.advanceTimersByTime(300);
  expect(submit).not.toHaveBeenCalled();
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "p" } });
  vi.advanceTimersByTime(200);
  fireEvent.change(input, { target: { value: "paper" } });
  vi.advanceTimersByTime(299);
  expect(submit).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(submit).toHaveBeenCalledTimes(1);
});
test("Enter during debounce does not submit twice", () => {
  policy.delay = 300;
  vi.useFakeTimers();
  const submit = vi.fn();
  render(<Field submit={submit} />);
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "paper" } });
  fireEvent.keyDown(input, { key: "Enter" });
  vi.advanceTimersByTime(300);
  expect(submit).toHaveBeenCalledTimes(1);
});

test("clear has an explicit button target and keeps input focus", () => {
  const submit = vi.fn();
  render(<Field submit={submit} />);
  const input = screen.getByRole("searchbox");
  fireEvent.change(input, { target: { value: "paper" } });
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
  expect((input as HTMLInputElement).value).toBe("");
  expect(document.activeElement).toBe(input);
  expect(submit).toHaveBeenCalledWith("");
});
