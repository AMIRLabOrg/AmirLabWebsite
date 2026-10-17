"use client";
import { useEffect, useState } from "react";
import { AdminOnly } from "@/components/admin-only";
import { useAuth } from "@/components/auth-provider";
import { ButtonControl } from "@/components/ui/button-control";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { FormField } from "@/components/ui/form-field";
import { PasswordField } from "@/components/ui/password-field";
import { InputControl, TextareaControl } from "@/components/ui/form-controls";
import { SelectControl } from "@/components/ui/select-control";
import { SemanticStatus } from "@/components/ui/semantic-status";
import {
  WorkspaceHero,
  WorkspacePanel,
  WorkspaceSurface,
} from "@/components/ui/workspace-surface";
import { apiRequest } from "@/lib/client-api";
type Provider = "local" | "s3" | "sftp";
interface BackupSettingsValue {
  provider?: Provider;
  directory?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
  prefix?: string;
  forcePathStyle?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
  host?: string;
  port?: number;
  username?: string;
  remoteDirectory?: string;
  hostKey?: string;
  authentication?: "privateKey" | "password";
  privateKey?: string;
  password?: string;
  enabled: boolean;
  intervalMinutes: number;
}
interface BackupStatus {
  configured: boolean;
  provider: string | null;
  settings: BackupSettingsValue | null;
  canBackup: boolean;
  canRestore: boolean;
  restoreRequiresOffline?: boolean;
  busy: boolean;
  backups: {
    id: string;
    createdAt: string;
    verified: boolean | null;
    purpose?: "manual" | "scheduled" | "safety";
  }[];
  lastBackup: { id: string; createdAt: string; verified: boolean } | null;
  reason: string | null;
}
export function BackupSettings() {
  const { user } = useAuth();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [settings, setSettings] = useState<BackupSettingsValue>({
    directory: "",
    enabled: false,
    intervalMinutes: 1440,
  });
  const [dirty, setDirty] = useState(false);
  function setDraft(value: BackupSettingsValue) {
    setSettings(value);
    setDirty(true);
    setMessage(undefined);
  }
  const [selected, setSelected] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (user?.role !== "ADMIN") return;
    let active = true;
    void apiRequest<BackupStatus>("/backups/status", { method: "GET" })
      .then((value) => {
        if (!active) return;
        setStatus(value);
        if (value.settings)
          setSettings({
            ...value.settings,
            provider: value.settings.provider ?? "local",
            accessKeyId: "",
            secretAccessKey: "",
            privateKey: "",
            password: "",
          });
        setSelected(
          value.backups.find(
            (backup) =>
              backup.verified !== false && backup.purpose !== "safety",
          )?.id ?? "",
        );
      })
      .catch(() => {
        if (active) {
          setError(true);
          setMessage(
            "Unable to check backup configuration. Reload and try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [user?.role]);
  async function action(kind: "configure" | "capture" | "restore") {
    setBusy(true);
    setError(false);
    setMessage(undefined);
    try {
      if (kind === "configure")
        await apiRequest("/backups/settings", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            Object.fromEntries(
              Object.entries(settings).filter(
                ([key]) =>
                  provider !== "local" ||
                  ![
                    "accessKeyId",
                    "secretAccessKey",
                    "privateKey",
                    "password",
                  ].includes(key),
              ),
            ),
          ),
        });
      if (kind === "capture") await apiRequest("/backups", { method: "POST" });
      if (kind === "restore") {
        if (confirmation !== "RESTORE" || !selected) return;
        await apiRequest(`/backups/${encodeURIComponent(selected)}/restore`, {
          method: "POST",
        });
        setConfirmation("");
        setMessage(
          "Local database and uploads restored. Reload to refresh your session.",
        );
        setStatus((previous) =>
          previous
            ? { ...previous, canBackup: false, canRestore: false }
            : previous,
        );
        return;
      }
      const value = await apiRequest<BackupStatus>("/backups/status", {
        method: "GET",
      });
      setStatus(value);
      setDirty(false);
      if (value.settings)
        setSettings({
          ...value.settings,
          provider: value.settings.provider ?? "local",
          accessKeyId: "",
          secretAccessKey: "",
          privateKey: "",
          password: "",
        });
      setSelected(
        value.backups.find(
          (backup) => backup.verified !== false && backup.purpose !== "safety",
        )?.id ?? "",
      );
      setMessage(
        kind === "configure"
          ? "Backup settings saved."
          : "Backup created and integrity checked.",
      );
    } catch (caught) {
      setError(true);
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Backup operation failed. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const provider = settings.provider ?? "local";
  const disabled = busy || !!status?.busy;
  const blocked = disabled || status?.reason === "UNSUPPORTED_SOURCE";
  function changeProvider(next: Provider) {
    setDraft({
      provider: next,
      enabled: false,
      intervalMinutes: settings.intervalMinutes,
      ...(next === "local"
        ? { directory: "" }
        : next === "s3"
          ? {
              bucket: "",
              region: "us-east-1",
              endpoint: "",
              prefix: "",
              forcePathStyle: false,
              accessKeyId: "",
              secretAccessKey: "",
            }
          : {
              host: "",
              port: 22,
              username: "",
              remoteDirectory: "",
              hostKey: "",
              authentication: "privateKey",
              privateKey: "",
              password: "",
            }),
    });
  }
  function field(
    key: keyof BackupSettingsValue,
    label: string,
    options: {
      placeholder?: string;
      secret?: boolean;
      multiline?: boolean;
      optional?: boolean;
      description?: string;
    } = {},
  ) {
    const props = {
      id: `backup-${key}`,
      value: String(settings[key] ?? ""),
      loading: !status,
      disabled: blocked,
      required: !options.optional,
      onChange: (
        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
      ) => setDraft({ ...settings, [key]: event.target.value }),
    };
    if (options.secret)
      return (
        <PasswordField
          key={key}
          label={label}
          {...props}
          autoComplete="new-password"
        />
      );
    return (
      <FormField
        key={key}
        htmlFor={props.id}
        label={label}
        description={options.description}
      >
        {options.multiline ? (
          <TextareaControl
            placeholder={options.placeholder ?? `Enter ${label.toLowerCase()}`}
            {...props}
            spellCheck={false}
            autoComplete="off"
          />
        ) : (
          <InputControl
            placeholder={options.placeholder ?? `Enter ${label.toLowerCase()}`}
            {...props}
          />
        )}
      </FormField>
    );
  }
  return (
    <AdminOnly>
      <WorkspaceSurface>
        <WorkspaceHero
          eyebrow="Administration"
          title="Backup & restore"
          description="Back up PostgreSQL and uploaded files together."
        />
        <WorkspacePanel
          title="Backup storage & schedule"
          description="Settings take effect without redeploying. Backups require local upload storage."
        >
          <form
            className="grid gap-4 px-[var(--workspace-gutter)] py-5"
            onSubmit={(event) => {
              event.preventDefault();
              void action("configure");
            }}
          >
            <SemanticStatus tone={error ? "error" : "neutral"}>
              {message ??
                (!status
                  ? "Checking backup configuration…"
                  : status.reason === "UNSUPPORTED_SOURCE"
                    ? "Unavailable: backups require PostgreSQL and local uploads. S3 upload sources are not supported."
                    : status.reason === "STORAGE_UNAVAILABLE"
                      ? "Storage unavailable. Check connection fields, credentials and permissions, then save again."
                      : status.configured
                        ? "Backup storage configured"
                        : "Storage not configured")}
            </SemanticStatus>
            <FormField htmlFor="backup-provider" label="Storage preset">
              <SelectControl
                id="backup-provider"
                value={provider}
                loading={!status}
                disabled={blocked}
                onValueChange={(value) => changeProvider(value as Provider)}
                options={[
                  { value: "local", label: "Same server / local directory" },
                  { value: "s3", label: "S3-compatible storage" },
                  { value: "sftp", label: "SFTP server" },
                ]}
              />
            </FormField>
            {provider === "local" &&
              field("directory", "Backup directory", {
                description:
                  "Absolute path outside uploads. Keep the directory and backup ID for recovery if the database is cleared.",
              })}
            {provider === "s3" && (
              <>
                {field("bucket", "Bucket")}
                {field("region", "Region")}
                {field("endpoint", "Endpoint (optional)", {
                  optional: true,
                  description:
                    "Leave empty for AWS S3. Use HTTPS for other S3-compatible services.",
                })}
                {field("prefix", "Folder prefix (optional)", {
                  optional: true,
                })}
                {field("accessKeyId", "Access key ID", {
                  secret: true,
                  optional: true,
                })}
                {field("secretAccessKey", "Secret access key", {
                  secret: true,
                  optional: true,
                })}
                <CheckboxControl
                  id="backup-path-style"
                  disabled={blocked}
                  checked={settings.forcePathStyle ?? false}
                  onCheckedChange={(forcePathStyle) =>
                    setDraft({ ...settings, forcePathStyle })
                  }
                >
                  Use path-style addressing
                </CheckboxControl>
              </>
            )}
            {provider === "sftp" && (
              <>
                {field("host", "Host")}
                <FormField htmlFor="backup-port" label="Port">
                  <InputControl
                    placeholder={"e.g. 587"}
                    id="backup-port"
                    type="number"
                    min={1}
                    max={65535}
                    value={settings.port ?? 22}
                    disabled={blocked}
                    required
                    onChange={(event) =>
                      setDraft({
                        ...settings,
                        port: Number(event.target.value),
                      })
                    }
                  />
                </FormField>
                {field("username", "Username")}
                {field("remoteDirectory", "Remote directory", {
                  description: "Absolute path on the SFTP server.",
                })}
                {field("hostKey", "Trusted host public key", {
                  description:
                    "Paste the verified SSH public host key, for example ssh-ed25519 AAAA…. Obtain it from the server administrator.",
                })}
                <FormField
                  htmlFor="backup-authentication"
                  label="Authentication"
                >
                  <SelectControl
                    id="backup-authentication"
                    value={settings.authentication ?? "privateKey"}
                    disabled={blocked}
                    onValueChange={(value) =>
                      setDraft({
                        ...settings,
                        authentication: value as "privateKey" | "password",
                        privateKey: "",
                        password: "",
                      })
                    }
                    options={[
                      { value: "privateKey", label: "Private key" },
                      { value: "password", label: "Password" },
                    ]}
                  />
                </FormField>
                {settings.authentication === "password"
                  ? field("password", "SFTP password", {
                      secret: true,
                      optional: true,
                    })
                  : field("privateKey", "Private key", {
                      multiline: true,
                      optional: true,
                      description:
                        "Unencrypted dedicated SSH private key. Stored encrypted by the API.",
                    })}
              </>
            )}
            {provider !== "local" && (
              <p className="text-xs text-ink-muted">
                Credentials are stored encrypted. Leave secret fields blank to
                keep saved credentials for the same preset and authentication
                method. Verify remote delivery with a manual backup before
                enabling its schedule.
              </p>
            )}
            <FormField htmlFor="backup-interval" label="Interval (minutes)">
              <InputControl
                placeholder={"e.g. 60"}
                id="backup-interval"
                loading={!status}
                disabled={disabled}
                type="number"
                min={1}
                max={10080}
                value={settings.intervalMinutes}
                required
                onChange={(event) =>
                  setDraft({
                    ...settings,
                    intervalMinutes: Number(event.target.value),
                  })
                }
              />
            </FormField>
            <CheckboxControl
              id="backup-schedule"
              loading={!status}
              disabled={disabled}
              checked={settings.enabled}
              onCheckedChange={(enabled) => setDraft({ ...settings, enabled })}
            >
              Enable scheduled backups
            </CheckboxControl>
            <p className="text-xs text-ink-muted">
              The API must be running. The schedule is checked every minute. An
              enabled schedule with no backup runs on the next check.
            </p>
            <ButtonControl
              className="justify-self-end"
              type="submit"
              variant="primary"
              loading={!status}
              busy={busy}
              disabled={blocked}
            >
              Save backup settings
            </ButtonControl>
          </form>
        </WorkspacePanel>
        <WorkspacePanel
          title="Create a backup"
          description="Includes a PostgreSQL archive and local uploads, with SHA-256 integrity checks. Pause database and upload writes for a coordinated recovery point."
        >
          <div className="grid gap-3 px-[var(--workspace-gutter)] py-5">
            <p className="text-xs text-ink-muted">
              Last backup:{" "}
              {status?.lastBackup
                ? new Date(status.lastBackup.createdAt).toLocaleString()
                : "None available"}
              . Integrity checks do not replace a restore test.
              {dirty &&
                " Save changed settings before creating or restoring a backup."}
            </p>
            <ButtonControl
              className="justify-self-end"
              disabled={disabled || dirty || !status?.canBackup}
              onClick={() => void action("capture")}
            >
              Create backup
            </ButtonControl>
          </div>
        </WorkspacePanel>
        <WorkspacePanel
          title="Restore a backup"
          description="Replaces database records and uploaded files. Stop other writes before restoring. A safety backup is created first."
        >
          <div className="grid gap-4 px-[var(--workspace-gutter)] py-5">
            {status?.restoreRequiresOffline && (
              <p className="text-sm text-ink-muted">
                Production recovery runs offline. Stop all API instances and
                workers, then run the backend backup:restore command with
                --replace-data and --services-stopped. See the README for
                recovery instructions.
              </p>
            )}
            <FormField htmlFor="backup-selection" label="Backup">
              <SelectControl
                id="backup-selection"
                value={selected}
                disabled={
                  disabled ||
                  dirty ||
                  (!status?.canRestore && !status?.restoreRequiresOffline)
                }
                onValueChange={setSelected}
                placeholder="Select a backup"
                options={
                  status?.backups
                    .filter((backup) => backup.verified !== false)
                    .map((backup) => ({
                      value: backup.id,
                      label: `${new Date(backup.createdAt).toLocaleString()}${backup.purpose === "safety" ? " · Safety snapshot" : ""}${backup.verified === null ? " · Integrity unchecked" : ""} · ${backup.id}`,
                    })) ?? []
                }
              />
            </FormField>
            <FormField
              htmlFor="backup-confirmation"
              label="Type RESTORE to replace local data"
            >
              <InputControl
                placeholder={"RESTORE"}
                id="backup-confirmation"
                value={confirmation}
                disabled={disabled || dirty || !status?.canRestore}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </FormField>
            <ButtonControl
              className="justify-self-end"
              variant="danger"
              disabled={
                disabled ||
                dirty ||
                !status?.canRestore ||
                !selected ||
                confirmation !== "RESTORE"
              }
              onClick={() => void action("restore")}
            >
              Restore backup
            </ButtonControl>
          </div>
        </WorkspacePanel>
      </WorkspaceSurface>
    </AdminOnly>
  );
}
