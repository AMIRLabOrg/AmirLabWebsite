"use client";

import { FormEvent, useState } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { apiRequest } from "@/lib/client-api";
import { PasswordField } from "@/components/ui/password-field";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";

export function AccountSetupForm({ token }: { token?: string }) {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }
    setError(undefined);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== form.get("confirmPassword")) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const result = await apiRequest<{ csrfToken: string }>("/auth/setup", {
        body: JSON.stringify({ password, token }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      sessionStorage.setItem("amirl_csrf", result.csrfToken);
      window.location.assign("/workspace");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to set password.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="rounded-panel border border-line bg-surface">
        <p className="m-0 flex items-center gap-[.45rem] text-[.82rem] leading-[1.5] text-ink-muted rounded-panel bg-danger-soft p-[.8rem] text-danger" role="alert">
          This account setup link is missing its token.
        </p>
        <ButtonLink href="/login">
          Return to login
        </ButtonLink>
      </div>
    );
  }

  return (
    <form className="rounded-panel border border-line bg-surface grid gap-[1.2rem]" onSubmit={submit}>
      <div>
        <PasswordField
          autoComplete="new-password"
          id="setup-password"
          label="Create password"
          maxLength={PASSWORD_MAX_LENGTH}
          minLength={PASSWORD_MIN_LENGTH}
          name="password"
          required
        />
        <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">
          Use at least {PASSWORD_MIN_LENGTH} characters. Passphrases are
          welcome.
        </p>
      </div>
      <PasswordField
        autoComplete="new-password"
        id="setup-password-confirm"
        label="Confirm password"
        maxLength={PASSWORD_MAX_LENGTH}
        minLength={PASSWORD_MIN_LENGTH}
        name="confirmPassword"
        required
      />
      {error ? (
        <p className="m-0 flex items-center gap-[.45rem] text-[.82rem] leading-[1.5] text-ink-muted rounded-panel bg-danger-soft p-[.8rem] text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <ButtonControl disabled={loading} type="submit" variant="primary">
        {loading ? "Creating password…" : "Create password"}
      </ButtonControl>
    </form>
  );
}
