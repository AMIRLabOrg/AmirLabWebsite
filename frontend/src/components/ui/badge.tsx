"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { shortenLabel } from "@/lib/shorten-label";

export type BadgeTone = "success" | "warning" | "info" | "error" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  success: "border-success/25 bg-success-soft text-success",
  warning: "border-warning/25 bg-warning-soft text-warning",
  info: "border-info/25 bg-info-soft text-info",
  error: "border-danger/25 bg-danger-soft text-danger",
  neutral: "border-line-strong bg-surface text-ink-muted",
};

const dotClass: Record<BadgeTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-info",
  error: "bg-danger",
  neutral: "bg-ink-muted",
};

export function Badge({
  children,
  dot = false,
  live = false,
  tone = "neutral",
  loading = false,
}: {
  children: ReactNode;
  dot?: boolean;
  live?: boolean;
  tone?: BadgeTone;
  loading?: boolean;
}) {
  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const label =
    typeof children === "string" && !loading
      ? shortenLabel(children)
      : children;
  const shortened = label !== children;
  return (
    <span
      className={cn(
        "group/badge relative inline-flex min-h-6 w-fit items-center gap-[5px] whitespace-nowrap rounded-[var(--radius-small)] border px-2 py-0.5 font-mono text-[10px] font-medium tracking-[.035em]",
        toneClass[tone],
        live &&
          !loading &&
          "animate-[badge-pulse_2s_infinite] motion-reduce:animate-none",
        loading && loadingPlaceholder(true, "label"),
        shortened &&
          "cursor-help focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2",
      )}
      tabIndex={shortened ? 0 : undefined}
      onMouseEnter={() => setTooltipDismissed(false)}
      onFocus={() => setTooltipDismissed(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") setTooltipDismissed(true);
      }}
      data-loading={loading || undefined}
      data-placeholder={loading ? "label" : undefined}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            "h-1.5 w-1.5 rounded-full",
            dotClass[tone],
            loading && "invisible",
          )}
        />
      ) : null}
      {shortened ? (
        <>
          <span aria-hidden="true">{label}</span>
          <span className="sr-only">{children}</span>
          <span
            aria-hidden="true"
            role="tooltip"
            className={cn(
              "invisible absolute bottom-full left-0 z-50 w-max max-w-[min(20rem,80vw)] pb-2 font-sans text-xs leading-relaxed font-normal whitespace-normal tracking-normal",
              !tooltipDismissed &&
                "group-hover/badge:visible group-focus/badge:visible",
            )}
          >
            <span className="block rounded-control bg-ink px-3 py-2 text-surface shadow-lg">
              {children}
            </span>
          </span>
        </>
      ) : (
        children
      )}
    </span>
  );
}
