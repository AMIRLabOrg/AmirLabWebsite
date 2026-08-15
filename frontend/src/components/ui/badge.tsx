import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export type BadgeTone = "field" | "gold" | "neutral" | "rust";

const toneClass: Record<BadgeTone, string> = {
  field: "bg-brand-soft text-brand-hover",
  gold: "bg-gold-soft text-review",
  neutral: "border-line bg-surface text-ink-muted",
  rust: "bg-danger-soft text-danger",
};

const dotClass: Record<BadgeTone, string> = {
  field: "bg-brand",
  gold: "bg-gold",
  neutral: "bg-ink-muted",
  rust: "bg-danger",
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
      {dot ? <span aria-hidden="true" className={cn("h-1.5 w-1.5 rounded-full", dotClass[tone])} /> : null}
      {children}
    </span>
  );
}
