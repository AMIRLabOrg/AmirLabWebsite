import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BulkReviewBar } from "./bulk-review-bar";
vi.mock("@/components/notification-provider", () => ({
  useNotifications: () => ({ showToast: vi.fn() }),
}));
afterEach(cleanup);
it("keeps a focused reviewer note and action labels during refresh", () => {
  const props = {
    actions: [
      {
        status: "REJECTED",
        label: "Reject",
        requiresNote: true,
        tone: "danger" as const,
        confirmLabel: "Reject",
        confirmTitle: "Reject?",
        confirmDescription: "Reject changes",
      },
    ],
    onClear: vi.fn(),
    onSelectAll: vi.fn(),
    onSubmit: vi.fn(),
    selectAllState: false,
    selectedCount: 1,
    selectableCount: 1,
    successBody: () => "Saved",
    successTitle: "Saved",
  };
  const { rerender } = render(<BulkReviewBar {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Reject" }));
  const note = screen.getByLabelText("Reviewer note");
  fireEvent.change(note, { target: { value: "Keep this draft" } });
  note.focus();
  rerender(<BulkReviewBar {...props} loading />);
  expect(screen.getByLabelText("Reviewer note")).toBe(note);
  expect(note).toHaveFocus();
  expect(note).toHaveValue("Keep this draft");
  const submit = screen.getByRole("button", { name: "Send review" });
  expect(submit).toBeDisabled();
  expect(submit).not.toHaveAttribute("data-placeholder");
});
