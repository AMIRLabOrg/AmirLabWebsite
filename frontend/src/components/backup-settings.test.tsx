import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BackupSettings } from "./backup-settings";
import { apiRequest } from "@/lib/client-api";
vi.mock("@/lib/client-api", () => ({ apiRequest: vi.fn() }));
vi.mock("./auth-provider", () => ({
  useAuth: () => ({ loading: false, user: { role: "ADMIN" } }),
}));
vi.mock("./admin-only", () => ({
  AdminOnly: ({ children }: { children: React.ReactNode }) => children,
}));
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
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
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
const status = {
  configured: true,
  provider: "local",
  canBackup: true,
  canRestore: true,
  busy: false,
  reason: null,
  settings: {
    directory: "/tmp/amirlab-backups",
    enabled: true,
    intervalMinutes: 60,
  },
  backups: [
    { id: "backup-1", createdAt: "2026-10-12T00:00:00Z", verified: true },
  ],
  lastBackup: null,
};
it("enables production backups and explains offline recovery", async () => {
  vi.mocked(apiRequest).mockResolvedValue({
    ...status,
    canRestore: false,
    restoreRequiresOffline: true,
  });
  render(<BackupSettings />);
  await screen.findByText(/Stop all API instances and workers/);
  expect(
    (
      screen.getByRole("button", {
        name: "Save backup settings",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  expect(
    (screen.getByRole("button", { name: "Create backup" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
  expect(
    (
      screen.getByRole("button", {
        name: "Restore backup",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
});
it("saves schedule settings and manually triggers a backup", async () => {
  vi.mocked(apiRequest).mockResolvedValue(status);
  render(<BackupSettings />);
  const directory = await screen.findByLabelText("Backup directory");
  await waitFor(() =>
    expect((directory as HTMLInputElement).value).toBe("/tmp/amirlab-backups"),
  );
  fireEvent.change(screen.getByLabelText("Interval (minutes)"), {
    target: { value: "120" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save backup settings" }));
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith(
      "/backups/settings",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({
          directory: "/tmp/amirlab-backups",
          enabled: true,
          intervalMinutes: 120,
          provider: "local",
        }),
      }),
    ),
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Create backup",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create backup" }));
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith("/backups", { method: "POST" }),
  );
});
it("requires a typed confirmation before restoring local data", async () => {
  vi.mocked(apiRequest).mockResolvedValue(status);
  render(<BackupSettings />);
  const restore = await screen.findByRole("button", { name: "Restore backup" });
  expect((restore as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(
    screen.getByLabelText("Type RESTORE to replace local data"),
    { target: { value: "RESTORE" } },
  );
  await waitFor(() =>
    expect((restore as HTMLButtonElement).disabled).toBe(false),
  );
  fireEvent.click(restore);
  await waitFor(() =>
    expect(apiRequest).toHaveBeenCalledWith("/backups/backup-1/restore", {
      method: "POST",
    }),
  );
});
it("shows successful restore without requiring an authenticated follow-up request", async () => {
  vi.mocked(apiRequest).mockReset();
  vi.mocked(apiRequest)
    .mockResolvedValueOnce(status)
    .mockResolvedValueOnce({ restored: true })
    .mockRejectedValue(new Error("Session no longer exists after recovery"));
  render(<BackupSettings />);
  const confirmation = await screen.findByLabelText(
    "Type RESTORE to replace local data",
  );
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Save backup settings",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.change(confirmation, { target: { value: "RESTORE" } });
  fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));
  await screen.findByText(
    "Local database and uploads restored. Reload to refresh your session.",
  );
});
it("changes preset fields, disables a changed schedule, and submits only S3 inputs", async () => {
  vi.mocked(apiRequest).mockResolvedValue(status);
  render(<BackupSettings />);
  await screen.findByLabelText("Backup directory");
  const preset = await screen.findByLabelText("Storage preset");
  fireEvent.click(preset);
  fireEvent.click(
    await screen.findByRole("option", { name: "S3-compatible storage" }),
  );
  expect(screen.queryByLabelText("Backup directory")).toBeNull();
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Enable scheduled backups",
      }) as HTMLButtonElement
    ).getAttribute("aria-checked"),
  ).toBe("false");
  fireEvent.change(screen.getByLabelText("Bucket"), {
    target: { value: "test-bucket" },
  });
  fireEvent.change(screen.getByLabelText("Access key ID"), {
    target: { value: "test-id" },
  });
  fireEvent.change(screen.getByLabelText("Secret access key"), {
    target: { value: "test-secret" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save backup settings" }));
  await waitFor(() => {
    const call = vi
      .mocked(apiRequest)
      .mock.calls.find(([path]) => path === "/backups/settings");
    const body = JSON.parse(call?.[1]?.body as string);
    expect(body).toMatchObject({
      provider: "s3",
      bucket: "test-bucket",
      secretAccessKey: "test-secret",
      enabled: false,
    });
    expect(body.directory).toBeUndefined();
  });
});
it("shows SFTP host verification and the selected authentication fields", async () => {
  vi.mocked(apiRequest).mockResolvedValue(status);
  render(<BackupSettings />);
  fireEvent.click(await screen.findByLabelText("Storage preset"));
  fireEvent.click(await screen.findByRole("option", { name: "SFTP server" }));
  expect(screen.getByLabelText("Trusted host public key")).toBeDefined();
  expect(screen.getByLabelText("Private key")).toBeDefined();
  fireEvent.click(screen.getByLabelText("Authentication"));
  fireEvent.click(await screen.findByRole("option", { name: "Password" }));
  expect(screen.queryByLabelText("Private key")).toBeNull();
  expect(screen.getByLabelText("SFTP password")).toBeDefined();
});
it("requires saving a changed destination before backup or restore", async () => {
  vi.mocked(apiRequest).mockResolvedValue(status);
  render(<BackupSettings />);
  const directory = await screen.findByLabelText("Backup directory");
  await waitFor(() =>
    expect(
      (
        screen.getByRole("button", {
          name: "Create backup",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false),
  );
  fireEvent.change(directory, { target: { value: "/tmp/changed" } });
  expect(
    (screen.getByRole("button", { name: "Create backup" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect((screen.getByLabelText("Backup") as HTMLButtonElement).disabled).toBe(
    true,
  );
});
