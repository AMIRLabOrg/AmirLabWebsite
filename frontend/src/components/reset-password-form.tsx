"use client";

import { FormEvent, useEffect, useState, useSyncExternalStore } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { ApiRequestError, apiRequest } from "@/lib/client-api";
import { ButtonControl, ButtonLink } from "@/components/ui/button-control";
import { FormMessage } from "@/components/ui/form-field";
import { PasswordField } from "@/components/ui/password-field";

const subscribeToHydration = () => () => undefined;

const RESET_TOKEN_STORAGE_KEY = "amirl_password_reset_token";
const RESET_TOKEN_EVENT = "amirl-password-reset-token";

function tokenFromLocation(): string | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash;
  if (!hash) return null;
  return (
    new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash)
      .get("token")
      ?.trim() || null
  );
}

function readResetToken(): string | null {
  if (typeof window === "undefined") return null;
  return tokenFromLocation() ?? sessionStorage.getItem(RESET_TOKEN_STORAGE_KEY);
}

function subscribeToResetToken(onStoreChange: () => void) {
  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener(RESET_TOKEN_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener(RESET_TOKEN_EVENT, onStoreChange);
  };
}

function retainResetToken(token: string) {
  sessionStorage.setItem(RESET_TOKEN_STORAGE_KEY, token);
  window.dispatchEvent(new Event(RESET_TOKEN_EVENT));
}

function forgetResetToken() {
  sessionStorage.removeItem(RESET_TOKEN_STORAGE_KEY);
  window.dispatchEvent(new Event(RESET_TOKEN_EVENT));
}

export function ResetPasswordForm() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const token = useSyncExternalStore(
    subscribeToResetToken,
    readResetToken,
    () => null,
  );
  const [saving, setSaving] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!hydrated || !token || !window.location.hash) return;
    // Retain the one-time credential outside React state before removing the
    // fragment from browser history. The external store keeps it available for
    // subsequent renders without a synchronous state write in an effect.
    retainResetToken(token);
    window.history.replaceState(null, "", "/reset-password");
  }, [hydrated, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || saving) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirmPassword") ?? "")) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      await apiRequest<{ reset: true }>("/auth/password-reset/complete", {
        body: JSON.stringify({ password, token }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      sessionStorage.removeItem("amirl_csrf");
      forgetResetToken();
      setComplete(true);
    } catch (caught) {
      const invalidReset =
        caught instanceof ApiRequestError &&
        (caught.code === "PASSWORD_RESET_INVALID" ||
          caught.status === 401 ||
          caught.status === 404);
      if (invalidReset) forgetResetToken();
      setError(
        invalidReset
          ? "This reset link is invalid or has expired. Request a new one."
          : caught instanceof ApiRequestError &&
              caught.code === "NETWORK_UNAVAILABLE"
            ? "Unable to reach the server. Check your connection and try again."
            : "The password could not be reset. Request a new link and try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="mt-8">
        <FormMessage tone="info">Checking reset link…</FormMessage>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mt-8 grid gap-4">
        <FormMessage>
          This reset link is invalid or has expired. Request a new one.
        </FormMessage>
        <ButtonLink
          className="justify-self-start"
          href="/forgot-password"
          variant="secondary"
        >
          Request a new link
        </ButtonLink>
      </div>
    );
  }

  if (complete) {
    return (
      <div className="mt-8 grid gap-4">
        <FormMessage tone="success">
          Your password has been changed. Existing signed-in sessions were
          closed.
        </FormMessage>
        <ButtonLink
          className="justify-self-start"
          href="/login"
          variant="primary"
        >
          Log in
        </ButtonLink>
      </div>
    );
  }

  return (
    <form
      aria-busy={saving || undefined}
      className="mt-8 grid gap-4"
      onSubmit={submit}
    >
      <PasswordField
        autoComplete="new-password"
        disabled={saving}
        id="reset-password"
        label="New password"
        maxLength={PASSWORD_MAX_LENGTH}
        minLength={PASSWORD_MIN_LENGTH}
        name="password"
        required
      />
      <PasswordField
        autoComplete="new-password"
        disabled={saving}
        id="reset-password-confirm"
        label="Confirm password"
        maxLength={PASSWORD_MAX_LENGTH}
        minLength={PASSWORD_MIN_LENGTH}
        name="confirmPassword"
        required
      />
      <p className="m-0 text-[.78rem] leading-[1.5] text-ink-muted">
        Use at least {PASSWORD_MIN_LENGTH} characters.
      </p>
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ButtonControl
        className="justify-self-start"
        disabled={saving}
        type="submit"
        variant="primary"
      >
        {saving ? "Resetting…" : "Reset password"}
      </ButtonControl>
    </form>
  );
}
