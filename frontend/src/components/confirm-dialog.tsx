"use client";

import { useEffect, useId, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { ButtonControl } from "@/components/ui/button-control";
import { cn } from "@/lib/cn";

interface ConfirmDialogProps { open: boolean; title: string; description: string; confirmLabel: string; busy?: boolean; tone?: "primary" | "danger"; onCancel: () => void; onConfirm: () => void; }

export function ConfirmDialog({ open, title, description, confirmLabel, busy = false, tone = "primary", onCancel, onConfirm }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="m-auto max-h-dvh w-[520px] max-w-full border-0 bg-transparent p-4 text-ink backdrop:bg-[color-mix(in_srgb,var(--ink)_62%,transparent)] backdrop:backdrop-blur-[5px]"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}
      ref={dialog}
    >
      <div className="relative animate-[dialog-enter_220ms_cubic-bezier(.22,1,.36,1)_both] rounded-panel border border-line bg-surface p-8 shadow-[0_30px_90px_color-mix(in_srgb,var(--ink)_28%,transparent)] motion-reduce:animate-none">
        <div className={cn("mb-[1.4rem] flex h-11 w-11 items-center justify-center rounded-full bg-brand-soft text-brand", tone === "danger" && "bg-danger-soft text-danger")}><AlertTriangle aria-hidden="true" size={20} /></div>
        <button aria-label="Close confirmation" className="absolute top-4 right-4 flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-full border border-line bg-transparent text-ink-muted" disabled={busy} onClick={onCancel} type="button"><X aria-hidden="true" size={19} /></button>
        <p className="mb-4 text-xs font-extrabold tracking-[.12em] text-brand uppercase">Confirm action</p>
        <h2 className="mt-0 mb-[.8rem] text-[clamp(1.7rem,4vw,2.25rem)] tracking-[-.04em]" id={titleId}>{title}</h2>
        <p className="m-0 leading-[1.65] text-ink-muted" id={descriptionId}>{description}</p>
        <div className="mt-8 flex justify-end gap-[.65rem]">
          <ButtonControl autoFocus disabled={busy} onClick={onCancel}>Cancel</ButtonControl>
          <ButtonControl disabled={busy} onClick={onConfirm} variant={tone}>{busy ? "Working…" : confirmLabel}</ButtonControl>
        </div>
      </div>
    </dialog>
  );
}
