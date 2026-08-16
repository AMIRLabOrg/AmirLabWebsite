import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export type SegmentTone = "brand" | "danger" | "gold" | "neutral" | "success";

export interface SegmentOption {
  label: string;
  tone?: SegmentTone;
  value: string;
}

const activeToneClass: Record<SegmentTone, string> = {
  brand: "bg-brand text-on-accent",
  danger: "bg-danger text-on-accent",
  gold: "bg-gold text-on-accent",
  neutral: "bg-ink-muted text-on-accent",
  success: "bg-success text-on-accent",
};

export function SegmentedControl({
  ariaLabel,
  disabled = false,
  loading = false,
  onValueChange,
  options,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  loading?: boolean;
  onValueChange: (value: string) => void;
  options: SegmentOption[];
  value: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn(
        "grid w-fit max-w-full grid-flow-col auto-cols-[minmax(max-content,1fr)] rounded-control border border-line bg-surface-subtle p-[3px]",
        loading && loadingPlaceholder(true, "control"),
      )}
      data-placeholder={loading ? "control" : undefined}
      role="radiogroup"
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            aria-checked={selected}
            className={cn(
              "min-h-9 cursor-pointer whitespace-nowrap rounded-control border-0 px-[.7rem] py-2 text-xs font-semibold text-ink-muted transition-[background,color,box-shadow] duration-[140ms] focus-visible:shadow-[0_0_0_3px_color-mix(in_srgb,var(--brand)_14%,transparent)] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
              !selected &&
                "bg-transparent hover:bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] hover:text-ink",
              selected && activeToneClass[option.tone ?? "brand"],
              selected &&
                "shadow-[0_2px_10px_color-mix(in_srgb,var(--ink)_10%,transparent)]",
            )}
            disabled={disabled || loading}
            key={option.value}
            onClick={() => onValueChange(option.value)}
            role="radio"
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
