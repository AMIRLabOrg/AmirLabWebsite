"use client";

import { FormEvent, useState } from "react";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/auth";
import { apiRequest } from "@/lib/client-api";
import { ButtonControl } from "@/components/ui/button-control";
import { PasswordField } from "@/components/ui/password-field";
import { InputControl } from "@/components/ui/form-controls";
import { FormField, FormMessage } from "@/components/ui/form-field";


export function LoginForm() {
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setLoading(true);
    const form = new FormData(event.currentTarget);
    try {
      const result = await apiRequest<{ csrfToken: string }>("/auth/login", {
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      sessionStorage.setItem("amirl_csrf", result.csrfToken);
      window.location.assign("/workspace");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to log in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form aria-busy={loading || undefined} className="mt-8 grid gap-4" onSubmit={submit}>
      <FormField className="gap-[.38rem]" htmlFor="login-email" label="Email" labelClassName="font-mono text-[.62rem] font-semibold uppercase tracking-[.045em]">
        <InputControl autoComplete="email" id="login-email" name="email" required type="email" />
      </FormField>
      <PasswordField autoComplete="current-password" id="login-password" label="Password" maxLength={PASSWORD_MAX_LENGTH} minLength={PASSWORD_MIN_LENGTH} name="password" required />
      {error ? <FormMessage>{error}</FormMessage> : null}
      <ButtonControl className="mt-1 min-w-[148px] justify-self-start max-[560px]:w-full" disabled={loading} type="submit">{loading ? "Logging in…" : "Log in"}</ButtonControl>
    </form>
  );
}
