"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/client-api";
import { FormField } from "@/components/ui/form-field";
import { InputControl } from "@/components/ui/form-controls";
import { ButtonControl } from "@/components/ui/button-control";

type KeyStatus = {
  configured: boolean;
  source: "admin" | "environment" | "none";
};

type Usage = {
  mode: "key" | "anonymous_shared";
  limit: number | null;
  remaining: number | null;
  resetAt: string | null;
  observedAt: string | null;
  unavailable: boolean;
};

export function OpenAlexApiSettings() {
  const [status, setStatus] = useState<KeyStatus>();
  const [usage, setUsage] = useState<Usage>();
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadUsage = useCallback(async () => {
    try {
      setUsage(
        await apiRequest<Usage>("/settings/openalex/usage", { method: "GET" }),
      );
    } catch {
      setUsage(undefined);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiRequest<KeyStatus>("/settings/openalex", { method: "GET" }),
      apiRequest<Usage>("/settings/openalex/usage", { method: "GET" }).catch(
        () => undefined,
      ),
    ])
      .then(([value, nextUsage]) => {
        if (active) {
          setStatus(value);
          setUsage(nextUsage);
        }
      })
      .catch(() => {
        if (active) {
          setMessage("Could not load OpenAlex settings.");
          setError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadUsage]);

  async function save(value: string) {
    setSaving(true);
    setError(false);
    setMessage(value ? "Checking API key…" : "Removing API key…");
    try {
      const next = await apiRequest<KeyStatus>("/settings/openalex", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: value }),
      });
      setStatus(next);
      await loadUsage();
      setApiKey("");
      setError(false);
      setMessage(next.configured ? "API key saved." : "API key removed.");
    } catch (value) {
      setError(true);
      setMessage(
        value instanceof Error ? value.message : "Could not save the API key.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="frame-rail-section grid gap-[1.1rem] py-5">
      <header className="border-b border-line pb-4">
        <p className="m-0 mb-4 text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">
          Research sync
        </p>
        <h2 className="font-sans text-[clamp(1.75rem,3vw,2.6rem)] font-normal leading-none">
          OpenAlex
        </h2>
        <p className="mt-3 text-sm text-ink-muted">
          A free API key increases the daily allowance. New keys are verified
          with OpenAlex before saving and apply to the next sync request.
        </p>
      </header>
      <FormField
        htmlFor="openalex-api-key"
        label="API key"
        message={message}
        messageTone={saving ? "muted" : error ? "error" : "success"}
      >
        <InputControl
          id="openalex-api-key"
          type="password"
          autoComplete="off"
          spellCheck={false}
          maxLength={512}
          loading={loading}
          disabled={saving}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={
            status?.configured
              ? "A key is configured. Enter a new key to replace it."
              : "Enter an OpenAlex API key"
          }
          value={apiKey}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <ButtonControl
          loading={loading}
          busy={saving}
          disabled={!apiKey.trim()}
          onClick={() => void save(apiKey.trim())}
        >
          Save API key
        </ButtonControl>
        {status?.configured ? (
          <ButtonControl
            disabled={saving}
            variant="danger-ghost"
            onClick={() => void save("")}
          >
            Remove API key
          </ButtonControl>
        ) : null}
        <span className="text-xs text-ink-muted">
          {status?.configured
            ? `Configured from ${status.source === "admin" ? "admin settings" : "the environment"}.`
            : "Using the anonymous allowance."}
        </span>
      </div>
      <section
        aria-label="OpenAlex daily allowance"
        className="grid gap-2 border-t border-line pt-4"
      >
        <div className="flex items-center justify-between gap-3">
          <strong className="text-sm font-semibold">Daily API allowance</strong>
          <ButtonControl
            disabled={loading}
            onClick={() => void loadUsage()}
            variant="secondary"
          >
            <RefreshCw aria-hidden="true" size={14} /> Refresh usage
          </ButtonControl>
        </div>
        {usage && usage.remaining !== null && usage.limit !== null ? (
          <>
            <progress
              aria-label="OpenAlex credits remaining"
              className="w-full accent-brand"
              max={usage.limit}
              value={usage.remaining}
            />
            <p className="m-0 text-xs text-ink-muted">
              {usage.remaining.toLocaleString()} of{" "}
              {usage.limit.toLocaleString()} credits remain.{" "}
              {usage.mode === "key"
                ? "Key allowance"
                : "Shared anonymous network allowance; approximate and last observed"}
              .
              {usage.resetAt
                ? ` Resets ${new Date(usage.resetAt).toLocaleString()}.`
                : ""}
              {usage.observedAt
                ? ` Updated ${new Date(usage.observedAt).toLocaleString()}.`
                : ""}
              {usage.unavailable
                ? " Live refresh failed; showing the last saved reading."
                : ""}
            </p>
          </>
        ) : (
          <p className="m-0 text-xs text-ink-muted">
            {usage?.unavailable
              ? "Could not read current usage; no recent reading is available."
              : "No usage reading yet. It will appear after an OpenAlex request."}
          </p>
        )}
      </section>
    </section>
  );
}
