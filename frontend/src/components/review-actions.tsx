"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useNotifications } from "@/components/notification-provider";
import { TextareaControl } from "@/components/ui/form-controls";
import { ButtonControl } from "@/components/ui/button-control";
import { cn } from "@/lib/cn";
import { FormField } from "@/components/ui/form-field";

export interface ReviewAction<Status extends string> {
  confirmDescription: string;
  confirmLabel: string;
  confirmTitle: string;
  disabled?: boolean;
  label: string;
  notePlaceholder?: string;
  pendingLabel?: string;
  requiresNote?: boolean;
  status: Status;
  tone: "primary" | "secondary" | "danger";
}

export function ReviewActions<Status extends string>({
  actions,
  className = "",
  errorTitle = "Review was not saved",
  noteLabel = "Reviewer note",
  loading = false,
  onSubmit,
  successBody,
  successTitle,
}: {
  actions: Array<ReviewAction<Status>>;
  className?: string;
  errorTitle?: string;
  noteLabel?: string;
  loading?: boolean;
  onSubmit: (decision: { note?: string; status: Status }) => Promise<void>;
  successBody: (status: Status) => string;
  successTitle: string;
}) {
  const { showToast } = useNotifications();
  const [active, setActive] = useState<ReviewAction<Status>>();
  const [confirming, setConfirming] = useState<ReviewAction<Status>>();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  function choose(action: ReviewAction<Status>) {
    setError(undefined);
    if (action.requiresNote && active?.status !== action.status) {
      setActive(action);
      return;
    }
    if (action.requiresNote && !note.trim()) {
      setActive(action);
      setError("Add a reviewer note before continuing.");
      return;
    }
    setConfirming(action);
  }

  async function submit(action: ReviewAction<Status>) {
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit({
        note: action.requiresNote ? note.trim() : undefined,
        status: action.status,
      });
      showToast({ body: successBody(action.status), title: successTitle });
      setActive(undefined);
      setConfirming(undefined);
      setNote("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Review failed.";
      setError(message);
      showToast({ body: message, title: errorTitle, tone: "error" });
      setConfirming(undefined);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("grid gap-4", className)} data-loading={loading || undefined}>
      {!loading && active?.requiresNote ? (
        <FormField className="min-w-0" htmlFor={`review-note-${active.status}`} label={noteLabel}>
          <TextareaControl
            id={`review-note-${active.status}`}
            onChange={(event) => {
              setNote(event.target.value);
              if (event.target.value.trim()) setError(undefined);
            }}
            placeholder={active.notePlaceholder ?? "Explain the decision clearly."}
            rows={4}
            value={note}
          />
        </FormField>
      ) : null}
      {error ? <p className="m-0 flex items-center gap-[.45rem] text-[.82rem] leading-[1.5] text-ink-muted rounded-panel bg-danger-soft p-[.8rem] text-danger" role="alert">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-3">
        {actions.map((action) => {
          const awaitingNote = action.requiresNote && active?.status === action.status;
          const disabled = loading || busy || action.disabled || Boolean(awaitingNote && !note.trim());
          return (
            <ButtonControl
              compact={className.includes("compact")}
              disabled={disabled}
              key={action.status}
              loading={loading}
              onClick={() => choose(action)}
              variant={action.tone}
            >
              {awaitingNote ? (action.pendingLabel ?? "Send review") : action.label}
            </ButtonControl>
          );
        })}
      </div>
      <ConfirmDialog
        busy={busy}
        confirmLabel={confirming?.confirmLabel ?? ""}
        description={confirming?.confirmDescription ?? ""}
        onCancel={() => setConfirming(undefined)}
        onConfirm={() => {
          if (confirming) void submit(confirming);
        }}
        open={Boolean(confirming)}
        title={confirming?.confirmTitle ?? ""}
        tone={confirming?.tone === "danger" ? "danger" : "primary"}
      />
    </div>
  );
}
