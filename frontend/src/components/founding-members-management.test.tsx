import type { ReactNode } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { apiRequest } from "@/lib/client-api";
import { FoundingMembersManagement } from "./founding-members-management";

vi.mock("@/lib/client-api", () => ({ apiRequest: vi.fn() }));
vi.mock("@/components/admin-only", () => ({
  AdminOnly: ({ children }: { children: ReactNode }) => children,
}));
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

it("removes a newly selected founder from co-founders and preserves the draft after a save failure", async () => {
  vi.mocked(apiRequest)
    .mockResolvedValueOnce({
      founderId: null,
      cofounderIds: ["alice"],
      people: [
        { id: "alice", fullName: "Alice", isPublished: true },
        { id: "bob", fullName: "Bob", isPublished: false },
      ],
    })
    .mockRejectedValueOnce(new Error("Save failed"));
  render(<FoundingMembersManagement />);
  await screen.findByRole("button", { name: "Remove co-founder Alice" });
  fireEvent.click(screen.getByRole("button", { name: "Founder" }));
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "Alice" },
  });
  fireEvent.click(screen.getByRole("option", { name: "Alice" }));
  expect(
    screen.queryByRole("button", { name: "Remove co-founder Alice" }),
  ).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Select co-founder" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Bob" } });
  expect(screen.queryByRole("option", { name: "Alice" })).toBeNull();
  fireEvent.click(screen.getByRole("option", { name: /Bob/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add co-founder" }));
  await screen.findByRole("button", { name: "Remove co-founder Bob" });
  fireEvent.click(
    screen.getByRole("button", { name: "Save founding members" }),
  );
  await screen.findByRole("alert");
  expect(
    screen.getByRole("button", { name: "Remove co-founder Bob" }),
  ).toBeTruthy();
  expect(vi.mocked(apiRequest).mock.calls[1]).toEqual([
    "/users/founding-members",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ founderId: "alice", cofounderIds: ["bob"] }),
    }),
  ]);
  vi.mocked(apiRequest).mockResolvedValueOnce({});
  fireEvent.click(
    screen.getByRole("button", { name: "Save founding members" }),
  );
  await waitFor(() =>
    expect(screen.getByRole("status").textContent).toBe(
      "Founding members saved.",
    ),
  );
});

it("requires confirmation before removing an added co-founder", async () => {
  vi.mocked(apiRequest).mockResolvedValueOnce({
    founderId: null,
    cofounderIds: ["alice"],
    people: [{ id: "alice", fullName: "Alice", isPublished: true }],
  });
  render(<FoundingMembersManagement />);
  fireEvent.click(
    await screen.findByRole("button", { name: "Remove co-founder Alice" }),
  );
  expect(
    screen.getByRole("dialog", { name: "Remove co-founder?" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(
    screen.getByRole("button", { name: "Remove co-founder Alice" }),
  ).toBeTruthy();
  fireEvent.click(
    screen.getByRole("button", { name: "Remove co-founder Alice" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove designation" }));
  expect(
    screen.queryByRole("button", { name: "Remove co-founder Alice" }),
  ).toBeNull();
  expect(apiRequest).toHaveBeenCalledTimes(1);
});
