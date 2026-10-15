"use client";

import {
  WorkspaceRecordPanel,
  WorkspaceRecordPanelHeader,
  WorkspaceRecordPanelTitle,
} from "@/components/workspace-record";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { ButtonControl } from "@/components/ui/button-control";
import { CheckboxControl } from "@/components/ui/checkbox-control";
import { FormField } from "@/components/ui/form-field";
import { InputControl } from "@/components/ui/form-controls";
import { SelectControl } from "@/components/ui/select-control";

type MailStatus = {
  configured: boolean;
  source: "admin" | "environment" | "none";
  provider: "SMTP" | "RESEND" | null;
  from: string | null;
  host: string | null;
  port: number | null;
  secure: boolean;
  requireTls: boolean;
  user: string | null;
  hasSecret: boolean;
};
type MailUsage = {
  configured: boolean;
  provider: string | null;
  unavailable?: boolean;
  used?: number | null;
  limit?: number | null;
  resetAt?: string | null;
  sent?: number;
  failed?: number;
  source?: string;
};

export function MailProviderSettings() {
  const [saved, setSaved] = useState<MailStatus>();
  const [usage, setUsage] = useState<MailUsage>();
  const [provider, setProvider] = useState<"SMTP" | "RESEND">("SMTP");
  const [from, setFrom] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("587");
  const [user, setUser] = useState("");
  const [secret, setSecret] = useState("");
  const [clearSecret, setClearSecret] = useState(false);
  const [secure, setSecure] = useState(false);
  const [requireTls, setRequireTls] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<MailStatus>("/settings/mail", { method: "GET" }),
      apiRequest<MailUsage>("/settings/mail/usage", { method: "GET" }).catch(
        () => undefined,
      ),
    ])
      .then(([status, nextUsage]) => {
        if (!active) return;
        setSaved(status);
        setUsage(nextUsage);
        setProvider(status.provider ?? "SMTP");
        setFrom(status.from ?? "");
        setHost(status.host ?? "");
        setPort(String(status.port ?? 587));
        setUser(status.user ?? "");
        setSecure(status.secure);
        setRequireTls(status.requireTls);
      })
      .catch(() => {
        if (active) {
          setError(true);
          setMessage("Could not load email settings.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setError(false);
    setMessage("Verifying provider settings…");
    try {
      const next = await apiRequest<MailStatus>("/settings/mail", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          from,
          ...(provider === "SMTP"
            ? { host, port: Number(port), user, secure, requireTls }
            : {}),
          ...(!clearSecret && secret ? { secret } : {}),
          ...(clearSecret ? { clearSecret: true } : {}),
          ...(provider === "SMTP" && clearSecret ? { user: "" } : {}),
        }),
      });
      setSaved(next);
      setSecret("");
      setClearSecret(false);
      setMessage(
        clearSecret
          ? "Saved settings and cleared the provider credential."
          : "Email settings saved and verified.",
      );
      setUsage(
        await apiRequest<MailUsage>("/settings/mail/usage", {
          method: "GET",
        }).catch(() => undefined),
      );
    } catch (caught) {
      setError(true);
      setMessage(
        caught instanceof Error
          ? caught.message
          : "Could not save email settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setSaving(true);
    setError(false);
    setMessage("Sending test email…");
    try {
      await apiRequest("/settings/mail/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      });
      setMessage(`Test email sent to ${testTo}.`);
    } catch (caught) {
      setError(true);
      setMessage(
        caught instanceof Error ? caught.message : "Test email failed.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <WorkspaceRecordPanel>
      <WorkspaceRecordPanelHeader>
        <p className="m-0 font-mono text-[.61rem] font-semibold uppercase tracking-[.11em] text-brand">
          Operations
        </p>
        <WorkspaceRecordPanelTitle>Email delivery</WorkspaceRecordPanelTitle>
        <p className="m-0 text-[.76rem] leading-[1.55] text-ink-muted">
          Configure the provider used for account access, notifications, and lab
          documents.
        </p>
      </WorkspaceRecordPanelHeader>
      <FormField htmlFor="mail-provider" label="Provider">
        <SelectControl
          id="mail-provider"
          value={provider}
          onValueChange={(value) => {
            setProvider(value as "SMTP" | "RESEND");
            setSecret("");
            setClearSecret(false);
          }}
          options={[
            { label: "SMTP server", value: "SMTP" },
            { label: "Resend", value: "RESEND" },
          ]}
        />
      </FormField>
      <FormField htmlFor="mail-from" label="From address">
        <InputControl
          id="mail-from"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          placeholder="AMIR Lab <mail@amirlab.org>"
        />
      </FormField>
      {provider === "SMTP" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField htmlFor="mail-host" label="SMTP host">
            <InputControl
              id="mail-host"
              value={host}
              onChange={(event) => setHost(event.target.value)}
              placeholder="smtp.example.org"
            />
          </FormField>
          <FormField htmlFor="mail-port" label="Port">
            <InputControl
              placeholder={"e.g. 587"}
              id="mail-port"
              inputMode="numeric"
              value={port}
              onChange={(event) => setPort(event.target.value)}
            />
          </FormField>
          <FormField htmlFor="mail-user" label="Username">
            <InputControl
              placeholder={"e.g. mail@example.com"}
              id="mail-user"
              value={user}
              onChange={(event) => setUser(event.target.value)}
              autoComplete="off"
            />
          </FormField>
          <FormField htmlFor="mail-secret" label="Password">
            <InputControl
              id="mail-secret"
              type="password"
              autoComplete="new-password"
              value={secret}
              onChange={(event) => setSecret(event.target.value)}
              placeholder={
                saved?.hasSecret
                  ? "Saved; leave blank to keep"
                  : "SMTP password"
              }
            />
          </FormField>
          <CheckboxControl
            id="mail-secure"
            checked={secure}
            onCheckedChange={setSecure}
          >
            Use implicit TLS
          </CheckboxControl>
          <CheckboxControl
            id="mail-require-tls"
            checked={requireTls}
            onCheckedChange={setRequireTls}
          >
            Require STARTTLS
          </CheckboxControl>
        </div>
      ) : (
        <FormField htmlFor="resend-secret" label="Resend API key">
          <InputControl
            id="resend-secret"
            type="password"
            autoComplete="new-password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={
              saved?.hasSecret ? "Saved; leave blank to keep" : "re_…"
            }
          />
        </FormField>
      )}
      {saved?.hasSecret && saved.provider === provider ? (
        <CheckboxControl
          id="mail-clear-secret"
          checked={clearSecret}
          onCheckedChange={(checked) => {
            setClearSecret(checked);
            if (checked) {
              setSecret("");
              if (provider === "SMTP") setUser("");
            }
          }}
        >
          Clear saved provider credential
        </CheckboxControl>
      ) : null}
      {message ? (
        <p
          role={error ? "alert" : "status"}
          className={
            error ? "m-0 text-sm text-danger" : "m-0 text-sm text-ink-muted"
          }
        >
          {message}
        </p>
      ) : null}
      <div className="-mx-[var(--workspace-gutter)] flex flex-wrap items-end justify-between gap-4 border-t border-line px-[var(--workspace-gutter)] pt-4">
        {saved?.configured ? (
          <div className="flex min-w-0 flex-wrap items-end gap-3 max-[640px]:w-full">
            <FormField
              className="min-w-0 flex-1"
              htmlFor="mail-test-to"
              label="Test recipient"
            >
              <InputControl
                id="mail-test-to"
                type="email"
                value={testTo}
                onChange={(event) => setTestTo(event.target.value)}
                placeholder="you@example.org"
              />
            </FormField>
            <ButtonControl
              disabled={!testTo.includes("@")}
              busy={saving}
              onClick={() => void sendTest()}
              variant="secondary"
            >
              Send test email
            </ButtonControl>
          </div>
        ) : null}
        <ButtonControl
          className="ml-auto"
          variant="primary"
          loading={loading}
          busy={saving}
          onClick={() => void save()}
        >
          Verify and save
        </ButtonControl>
      </div>
      <div className="-mx-[var(--workspace-gutter)] grid gap-2 border-t border-line px-[var(--workspace-gutter)] pt-4">
        <strong className="text-sm font-semibold">Email usage</strong>
        {!usage?.configured ? (
          <p className="m-0 text-xs text-ink-muted">
            Configure a provider to see usage.
          </p>
        ) : usage.unavailable ? (
          <p className="m-0 text-xs text-ink-muted">
            Provider usage is currently unavailable.
          </p>
        ) : usage.provider === "RESEND" ? (
          <p className="m-0 text-xs text-ink-muted">
            {usage.used ?? "—"} of {usage.limit ?? "—"} emails used today
            {usage.resetAt
              ? `; resets ${new Date(usage.resetAt).toLocaleString()}`
              : ""}
            .
          </p>
        ) : (
          <p className="m-0 text-xs text-ink-muted">
            Today: {usage.sent} SMTP deliveries succeeded and {usage.failed}{" "}
            delivery attempts failed. Generic SMTP does not expose the
            provider&apos;s account quota.
          </p>
        )}
        {saved ? (
          <span className="text-xs text-ink-muted">
            Provider: {saved.provider}; settings from {saved.source}.
          </span>
        ) : null}
      </div>
    </WorkspaceRecordPanel>
  );
}
