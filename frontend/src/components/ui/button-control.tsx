import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { forwardRef } from "react";
import type { ComponentProps, ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export type ActionVariant =
  | "add-another"
  | "add-empty"
  | "danger"
  | "danger-ghost"
  | "dark"
  | "dark-outline"
  | "dashed"
  | "dotted"
  | "ghost"
  | "primary"
  | "secondary";

const variantClass: Record<ActionVariant, string> = {
  primary: "border-transparent bg-brand text-on-accent hover:bg-brand-hover",
  secondary: "border-line-strong bg-surface text-ink hover:border-brand hover:bg-brand-faint hover:text-brand",
  ghost: "border-transparent bg-transparent text-ink hover:bg-brand-faint hover:text-brand",
  dashed: "border-dashed border-[color-mix(in_srgb,var(--brand)_48%,var(--line))] bg-transparent text-brand hover:border-brand hover:bg-brand-soft",
  dotted: "border-dotted border-[color-mix(in_srgb,var(--brand)_48%,var(--line))] bg-transparent text-brand hover:border-brand hover:bg-brand-soft",
  danger: "border-transparent bg-danger text-on-accent hover:bg-danger-hover",
  "danger-ghost": "border-transparent bg-transparent text-danger hover:bg-danger-soft hover:text-danger-hover",
  dark: "border-dark-line bg-transparent text-dark-ink hover:border-dark-ink hover:bg-dark-ink hover:text-dark-surface",
  "dark-outline": "border-dark-line bg-transparent text-dark-ink hover:border-dark-ink",
  "add-empty": "border-dashed border-[color-mix(in_srgb,var(--brand)_48%,var(--line))] bg-transparent text-brand hover:border-brand hover:bg-brand-soft",
  "add-another": "border-transparent bg-brand-soft text-brand hover:bg-[color-mix(in_srgb,var(--brand)_16%,var(--surface))]",
};

function actionClassName({
  className,
  compact,
  loading,
  variant,
}: {
  className?: string;
  compact?: boolean;
  loading?: boolean;
  variant: ActionVariant;
}) {
  return cn(
    "inline-flex h-[var(--control-height)] min-h-[var(--control-height)] cursor-pointer items-center justify-center gap-[.55rem] rounded-control border px-[.9rem] py-0 text-[.78rem] font-semibold transition-[border-color,background,color,box-shadow] duration-[140ms] focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none",
    variantClass[variant],
    compact && "h-9 min-h-9 px-[.7rem] text-xs",
    loading && loadingPlaceholder(true, "control"),
    className,
  );
}

function ExternalMarker() {
  return <ExternalLink aria-hidden="true" className="shrink-0" size={14} />;
}

export const ButtonControl = forwardRef<
  HTMLButtonElement,
  ComponentPropsWithRef<"button"> & {
    compact?: boolean;
    externalIcon?: boolean;
    loading?: boolean;
    variant?: ActionVariant;
  }
>(function ButtonControl(
  {
    children,
    className,
    compact,
    disabled,
    externalIcon = false,
    loading = false,
    type = "button",
    variant = "secondary",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={actionClassName({ className, compact, loading, variant })}
      data-loading={loading || undefined}
      data-placeholder={loading ? "control" : undefined}
      disabled={disabled || loading}
      type={type}
      {...props}
    >
      {children}
      {externalIcon ? <ExternalMarker /> : null}
    </button>
  );
});

export function ButtonLink({
  children,
  className,
  compact,
  externalIcon = false,
  loading = false,
  tabIndex,
  variant = "secondary",
  ...props
}: Omit<ComponentProps<typeof Link>, "className"> & {
  children: ReactNode;
  className?: string;
  compact?: boolean;
  externalIcon?: boolean;
  loading?: boolean;
  variant?: ActionVariant;
}) {
  return (
    <Link
      className={actionClassName({
        className: cn(loading && "pointer-events-none", className),
        compact,
        loading,
        variant,
      })}
      {...props}
      aria-disabled={loading || props["aria-disabled"] || undefined}
      data-placeholder={loading ? "control" : undefined}
      tabIndex={loading ? -1 : tabIndex}
    >
      {children}
      {externalIcon ? <ExternalMarker /> : null}
    </Link>
  );
}

export const ButtonAnchor = forwardRef<
  HTMLAnchorElement,
  ComponentPropsWithRef<"a"> & {
    compact?: boolean;
    externalIcon?: boolean;
    loading?: boolean;
    variant?: ActionVariant;
  }
>(function ButtonAnchor(
  {
    children,
    className,
    compact,
    externalIcon,
    loading = false,
    tabIndex,
    variant = "secondary",
    ...props
  },
  ref,
) {
  const showExternalIcon = externalIcon ?? props.target === "_blank";
  return (
    <a
      ref={ref}
      className={actionClassName({
        className: cn(loading && "pointer-events-none", className),
        compact,
        loading,
        variant,
      })}
      {...props}
      aria-disabled={loading || props["aria-disabled"] || undefined}
      data-placeholder={loading ? "control" : undefined}
      tabIndex={loading ? -1 : tabIndex}
    >
      {children}
      {showExternalIcon ? <ExternalMarker /> : null}
    </a>
  );
});
