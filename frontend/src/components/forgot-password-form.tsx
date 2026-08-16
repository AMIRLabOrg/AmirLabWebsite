"use client";

import { FormEvent, useState } from "react";
import { ApiRequestError, apiRequest } from "@/lib/client-api";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";
import { InputControl } from "@/components/ui/form-controls";
import { FormField, FormMessage } from "@/components/ui/form-field";

export function ForgotPasswordForm() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    setSending(true);
    setError(undefined);
    const form = new FormData(event.currentTarget);

    try {
      await apiRequest<{ accepted: true }>("/auth/password-reset/request", {
        body: JSON.stringify({ email: form.get("email") }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiRequestError &&
          caught.code === "NETWORK_UNAVAILABLE"
          ? "Unable to reach the server. Check your connection and try again."
          : "The reset request could not be sent. Try again.",
      );
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 grid gap-4">
        <FormMessage tone="success">
          If an active account uses that email, a password-reset link has been
          sent.
        </FormMessage>
        <p className="m-0 text-[.8rem] leading-[1.55] text-ink-muted">
          The newest reset link replaces any earlier one.
        </p>
        <ButtonLink
          className="justify-self-start"
          href="/login"
          variant="secondary"
        >
          Return to login
        </ButtonLink>
      </div>
    );
  }

  return (
    <form className="mt-8 grid gap-4" onSubmit={submit}>
      <FormField
        htmlFor="forgot-password-email"
        label="Account email"
        labelClassName="font-mono text-[.62rem] font-semibold uppercase tracking-[.045em]"
      >
        <InputControl
          autoComplete="email"
          disabled={sending}
          id="forgot-password-email"
          name="email"
          required
          type="email"
        />
      </FormField>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <div className="flex flex-wrap gap-3">
        <ButtonControl disabled={sending} type="submit" variant="primary">
          {sending ? "Sending…" : "Send reset link"}
        </ButtonControl>
        <ButtonLink href="/login" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
