"use client";

import { SyntheticEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { useNotifications } from "@/components/notification-provider";
import { ButtonControl } from "@/components/ui/button-control";
import { FormField, FormMessage } from "@/components/ui/form-field";
import { InputControl } from "@/components/ui/form-controls";
import { PasswordField } from "@/components/ui/password-field";
import { apiRequest } from "@/lib/client-api";

interface EmailChangeStatus {
  currentEmail: string | null;
  pending: { newEmail: string; otpExpiresAt: string } | null;
}

export function EmailChangePanel({ userId }: { userId?: string }) {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const [status, setStatus] = useState<EmailChangeStatus>();
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const basePath = userId
    ? `/users/${userId}/email-change`
    : "/auth/email-change";

  useEffect(() => {
    let active = true;
    void apiRequest<EmailChangeStatus>(basePath, { method: "GET" })
      .then((result) => {
        if (!active) return;
        setStatus(result);
        setNewEmail(result.pending?.newEmail ?? "");
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to load email settings.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [basePath]);

  async function requestChange(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const pending = await apiRequest<{
        newEmail: string;
        expiresAt: string;
      }>(`${basePath}/request`, {
        body: JSON.stringify({
          newEmail,
          ...(!userId ? { currentPassword } : {}),
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      setStatus((current) => ({
        currentEmail: current?.currentEmail ?? null,
        pending: {
          newEmail: pending.newEmail,
          otpExpiresAt: pending.expiresAt,
        },
      }));
      setCurrentPassword("");
      setOtp("");
      showToast({
        body: `A verification code was sent to ${pending.newEmail}.`,
        title: "Check the new email",
      });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to request the email change.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function verifyChange(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const result = await apiRequest<{ changed: true; currentEmail: string }>(
        `${basePath}/verify`,
        {
          body: JSON.stringify({ otp }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      );
      showToast({
        body: `The login email is now ${result.currentEmail}. Existing sessions were signed out.`,
        title: "Email changed",
      });
      if (!userId || userId === user?.id) {
        sessionStorage.removeItem("amirl_csrf");
        window.location.assign("/login");
        return;
      }
      setStatus({ currentEmail: result.currentEmail, pending: null });
      setNewEmail("");
      setOtp("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to verify the email change.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-auto mt-[1.35rem] grid w-full max-w-[1180px] gap-[1.2rem] rounded-panel border border-line bg-surface p-[1.55rem] shadow-[var(--shadow-panel)]">
      <div className="flex items-end justify-between gap-8 border-b border-line pb-[.95rem]">
        <div>
          <p className="m-0 mb-4 text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">
            Security
          </p>
          <h2 className="text-[1.35rem] font-semibold">Change login email</h2>
        </div>
      </div>

      <p className="m-0 max-w-[760px] text-[.82rem] leading-[1.6] text-ink-muted">
        The new address must be verified before it becomes the login email. The
        current address receives a time-limited cancel and revert link.
      </p>

      {error ? <FormMessage>{error}</FormMessage> : null}

      <form className="grid gap-[1rem]" onSubmit={requestChange}>
        <div className="grid grid-cols-2 gap-[1.2rem] max-[640px]:grid-cols-1">
          <FormField
            htmlFor={`${userId ?? "self"}-current-email`}
            label="Current email"
          >
            <InputControl
              disabled
              id={`${userId ?? "self"}-current-email`}
              loading={loading}
              value={status?.currentEmail ?? ""}
            />
          </FormField>
          <FormField
            htmlFor={`${userId ?? "self"}-new-email`}
            label="New email"
          >
            <InputControl
              id={`${userId ?? "self"}-new-email`}
              loading={loading}
              onChange={(event) => setNewEmail(event.target.value)}
              required
              type="email"
              value={newEmail}
            />
          </FormField>
          {!userId ? (
            <PasswordField
              id="email-change-current-password"
              label="Current password"
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              value={currentPassword}
            />
          ) : null}
        </div>
        <div>
          <ButtonControl
            disabled={saving || loading}
            loading={saving || loading}
            type="submit"
            variant="secondary"
          >
            {status?.pending ? "Send a new code" : "Send verification code"}
          </ButtonControl>
        </div>
      </form>

      {status?.pending ? (
        <form
          className="grid gap-[1rem] border-t border-line pt-[1.2rem]"
          onSubmit={verifyChange}
        >
          <p className="m-0 text-[.82rem] leading-[1.6] text-ink-muted">
            Enter the code sent to {status.pending.newEmail}. Requesting a new
            code invalidates the previous one.
          </p>
          <FormField
            htmlFor={`${userId ?? "self"}-email-otp`}
            label="Verification code"
          >
            <InputControl
              autoComplete="one-time-code"
              id={`${userId ?? "self"}-email-otp`}
              inputMode="numeric"
              maxLength={6}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              pattern="[0-9]{6}"
              required
              value={otp}
            />
          </FormField>
          <div>
            <ButtonControl
              disabled={saving || otp.length !== 6}
              loading={saving}
              type="submit"
              variant="primary"
            >
              Verify and change email
            </ButtonControl>
          </div>
        </form>
      ) : null}
    </section>
  );
}
