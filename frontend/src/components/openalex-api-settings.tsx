"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/client-api";
import { FormField } from "@/components/ui/form-field";
import { InputControl } from "@/components/ui/form-controls";
import { ButtonControl } from "@/components/ui/button-control";

type KeyStatus = {
  configured: boolean;
  source: "admin" | "environment" | "none";
};

export function OpenAlexApiSettings() {
  const [status, setStatus] = useState<KeyStatus>();
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void apiRequest<KeyStatus>("/settings/openalex", { method: "GET" })
      .then((value) => {
        if (active) setStatus(value);
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
  }, []);

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
          loading={loading || saving}
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
    </section>
  );
}
