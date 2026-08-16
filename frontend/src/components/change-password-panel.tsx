"use client";

import { useState } from "react";
import { ButtonControl } from "@/components/ui/button-control";
import { InputControl } from "@/components/ui/form-controls";
import { FormField } from "@/components/ui/form-field";
import { useNotifications } from "@/components/notification-provider";
import { apiRequest } from "@/lib/client-api";

export function ChangePasswordPanel() {
  const { showToast } = useNotifications();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    
    setSaving(true);
    try {
      await apiRequest("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
        headers: { "content-type": "application/json" },
      });
      showToast({ title: "Password changed", body: "Your password has been successfully updated." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="mx-auto mt-[1.35rem] grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)_320px] items-start gap-[1.35rem] max-[980px]:grid-cols-1"
      onSubmit={submit}
    >
      <section className="col-start-1 grid gap-[1.2rem] rounded-panel border border-line bg-surface p-[1.55rem] shadow-[var(--shadow-panel)] max-[980px]:col-start-1">
        <div className="mb-0 flex items-end justify-between gap-8 border-b border-line pb-[.95rem]">
          <div>
            <p className="m-0 mb-4 font-[var(--font-sans)] text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">
              Security
            </p>
            <h2 className="text-[1.35rem] font-semibold">Change password</h2>
          </div>
        </div>
        
        {error ? (
          <p className="m-0 flex items-center gap-[.45rem] text-[.82rem] leading-[1.5] text-ink-muted rounded-panel bg-danger-soft p-[.8rem] text-danger">
            {error}
          </p>
        ) : null}

        <div className="grid gap-[.8rem]">
          <div className="grid gap-[1.2rem] grid-cols-2 max-[640px]:grid-cols-1">
            <FormField htmlFor="current-password" label="Current password" className="col-span-full">
              <InputControl
                id="current-password"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </FormField>
            
            <FormField htmlFor="new-password" label="New password">
              <InputControl
                id="new-password"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </FormField>
            
            <FormField htmlFor="confirm-password" label="Confirm new password">
              <InputControl
                id="confirm-password"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </FormField>
          </div>
        </div>
        
        <div className="mt-2">
          <ButtonControl disabled={saving} loading={saving} type="submit" variant="secondary">
            {saving ? "Saving…" : "Update password"}
          </ButtonControl>
        </div>
      </section>
    </form>
  );
}
