import { useEffect, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ButtonControl } from "@/components/ui/button-control";
import { InputControl } from "@/components/ui/form-controls";
import { WorkspaceContent } from "./workspace-content";

const auth = vi.hoisted(() => ({
  loading: true,
  user: null as { id: string } | null,
}));
vi.mock("./auth-provider", () => ({ useAuth: () => auth }));
afterEach(() => {
  cleanup();
  auth.loading = true;
  auth.user = null;
});

test("withholds protected controls and effects until authentication", () => {
  const effect = vi.fn();
  function Page() {
    useEffect(effect, []);
    return <ButtonControl>Private action</ButtonControl>;
  }
  expect(
    renderToStaticMarkup(
      <WorkspaceContent>
        <Page />
      </WorkspaceContent>,
    ),
  ).not.toContain("Private action");
  const view = render(
    <WorkspaceContent>
      <Page />
    </WorkspaceContent>,
  );
  expect(screen.queryByRole("button", { name: "Private action" })).toBeNull();
  expect(effect).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toContain(
    "Checking workspace access",
  );
  auth.loading = false;
  auth.user = { id: "admin" };
  view.rerender(
    <WorkspaceContent>
      <Page />
    </WorkspaceContent>,
  );
  expect(screen.getByRole("button", { name: "Private action" })).toBeTruthy();
  expect(effect).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).toBeNull();
});

test("clears private state when the session ends or the account changes", () => {
  function Page() {
    const [draft, setDraft] = useState("");
    return (
      <InputControl
        aria-label="Private draft"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    );
  }
  auth.loading = false;
  auth.user = { id: "first" };
  const view = render(
    <WorkspaceContent>
      <Page />
    </WorkspaceContent>,
  );
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "secret draft" },
  });
  auth.user = null;
  view.rerender(
    <WorkspaceContent>
      <Page />
    </WorkspaceContent>,
  );
  expect(screen.queryByRole("textbox")).toBeNull();
  auth.user = { id: "second" };
  view.rerender(
    <WorkspaceContent>
      <Page />
    </WorkspaceContent>,
  );
  expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("");
});
