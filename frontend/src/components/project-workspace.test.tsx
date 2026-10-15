import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ProjectManager } from "./project-workspace";

vi.mock("@/components/notification-provider", () => ({
  useNotifications: () => ({ showToast: vi.fn() }),
}));
vi.mock("@/lib/client-api", () => ({
  apiRequest: vi.fn(async (path: string) =>
    path.includes("options")
      ? { people: [] }
      : {
          changeRequests: [],
          closingNote: null,
          endsAt: null,
          invitations: [],
          memberships: [],
          milestones: [],
          tasks: [],
          objective: null,
          objectives: [],
          progress: null,
          publicPageEnabled: false,
          researchItem: {
            id: "project-1",
            projectOutputs: [],
            reviewStatus: "ARCHIVED",
            slug: "test-project",
            summary: null,
            title: "Test project",
          },
          outputReferences: [],
          researchItemId: "project-1",
          resources: [],
          startsAt: null,
          status: "PLANNED",
          updates: [],
          version: 1,
        },
  ),
}));

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("keeps all seven project views accessible while archived content stays read-only", async () => {
  const view = render(<ProjectManager id="project-1" />);
  const titles = {
    Overview: "Overview",
    Tasks: "Tasks",
    Timeline: "Progress model",
    Updates: "Post an update",
    People: "Project team",
    Outputs: "Research outputs",
    Settings: "Settings",
  };
  await screen.findByRole("heading", { name: "Test project" });
  for (const [label, heading] of Object.entries(titles)) {
    const tab = screen.getByRole("tab", { name: label });
    await waitFor(() =>
      expect((tab as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.mouseDown(tab, { button: 0, ctrlKey: false });
    await screen.findByRole("heading", { name: heading });
    expect(
      (view.container.querySelector("fieldset") as HTMLFieldSetElement)
        .disabled,
    ).toBe(true);
  }
});
