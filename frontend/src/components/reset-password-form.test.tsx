import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/client-api";
import { ResetPasswordForm } from "./reset-password-form";

vi.mock("@/lib/client-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/client-api")>();
  return { ...original, apiRequest: vi.fn() };
});

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(apiRequest).mockReset();
  window.history.replaceState(
    null,
    "",
    "/reset-password#token=test-reset-token",
  );
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});

it("shows success after clearing the consumed reset token", async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({ reset: true });
  sessionStorage.setItem("amirl_csrf", "old-session");
  render(<ResetPasswordForm />);

  expect(window.location.hash).toBe("");
  expect(sessionStorage.getItem("amirl_password_reset_token")).toBe(
    "test-reset-token",
  );
  fireEvent.change(screen.getByLabelText("New password"), {
    target: { value: "new-test-password" },
  });
  fireEvent.change(screen.getByLabelText("Confirm password"), {
    target: { value: "new-test-password" },
  });
  fireEvent.submit(
    screen.getByRole("button", { name: "Reset password" }).closest("form")!,
  );

  expect(
    await screen.findByText(/Your password has been changed/),
  ).toBeTruthy();
  expect(screen.queryByText(/This reset link is invalid/)).toBeNull();
  expect(screen.getByRole("link", { name: "Log in" })).toBeTruthy();
  expect(sessionStorage.getItem("amirl_password_reset_token")).toBeNull();
  expect(sessionStorage.getItem("amirl_csrf")).toBeNull();
});
