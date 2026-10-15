"use client";
import * as Checkbox from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function CheckboxControl({
  ariaLabel,
  children,
  checked,
  className,
  defaultChecked,
  disabled,
  id,
  loading = false,
  name,
  onCheckedChange,
  required,
  value = "true",
}: {
  ariaLabel?: string;
  children?: ReactNode;
  checked?: boolean | "indeterminate";
  className?: string;
  defaultChecked?: boolean;
  disabled?: boolean;
  id: string;
  loading?: boolean;
  name?: string;
  onCheckedChange?: (checked: boolean) => void;
  required?: boolean;
  value?: string;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-[.7rem] whitespace-normal text-[.8rem] leading-[1.5] text-ink-muted",
        disabled || loading ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
      aria-busy={loading || undefined}
      htmlFor={id}
    >
      <Checkbox.Root
        aria-label={ariaLabel}
        className={cn(
          "mt-px inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-[var(--radius-checkbox)] border border-line bg-surface p-0 text-on-accent transition-[background,border-color,transform] duration-150 data-[state=checked]:scale-105 data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=indeterminate]:scale-105 data-[state=indeterminate]:border-brand data-[state=indeterminate]:bg-brand focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed motion-reduce:transition-none",
          loading && loadingPlaceholder(true, "text"),
          loading &&
            "bg-surface-subtle! text-transparent! data-[state=checked]:scale-100 data-[state=indeterminate]:scale-100",
        )}
        data-placeholder={loading ? "text" : undefined}
        checked={checked}
        defaultChecked={defaultChecked}
        disabled={disabled || loading}
        id={id}
        name={name}
        onCheckedChange={(nextChecked) =>
          onCheckedChange?.(nextChecked === true)
        }
        required={required}
        value={value}
      >
        <Checkbox.Indicator
          className={cn(
            "flex h-full w-full items-center justify-center",
            loading && "invisible",
          )}
        >
          {checked === "indeterminate" ? (
            <Minus aria-hidden="true" className="block" size={14} />
          ) : (
            <Check aria-hidden="true" className="block" size={14} />
          )}
        </Checkbox.Indicator>
      </Checkbox.Root>
      {children ? (
        <span
          className={cn("min-w-0", loading && loadingPlaceholder(true, "text"))}
          data-placeholder={loading ? "text" : undefined}
        >
          {children}
        </span>
      ) : null}
    </label>
  );
}
