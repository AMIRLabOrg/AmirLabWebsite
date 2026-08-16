import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export type BadgeTone = "success" | "warning" | "info" | "error" | "neutral";

const toneClass: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  error: "bg-danger-soft text-danger",
  neutral: "border-line bg-surface text-ink-muted",
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
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-[5px] whitespace-nowrap rounded-panel border border-transparent px-[9px] py-[3px] font-mono text-[11px] font-medium tracking-[.02em]",
        toneClass[tone],
        live && "animate-[badge-pulse_2s_infinite] motion-reduce:animate-none",
        loading && loadingPlaceholder(true, "label"),
      )}
      data-loading={loading || undefined}
      data-placeholder={loading ? "label" : undefined}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}
