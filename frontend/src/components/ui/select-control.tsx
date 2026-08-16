"use client";
import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export interface SelectOption {
  label: string;
  value: string;
}

export function SelectControl({
  ariaLabel,
  className,
  defaultValue,
  disabled,
  id,
  loading = false,
  name,
  onValueChange,
  options,
  placeholder = "Select…",
  required,
  size = "default",
  value,
}: {
  ariaLabel?: string;
  className?: string;
  defaultValue?: string;
  disabled?: boolean;
  id?: string;
  loading?: boolean;
  name?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  required?: boolean;
  size?: "compact" | "default";
  value?: string;
}) {
  const compact = size === "compact";
  return (
    <Select.Root
      defaultValue={defaultValue}
      disabled={disabled || loading}
      name={name}
      onValueChange={onValueChange}
      required={required}
      value={value}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-[var(--control-height)] min-h-[var(--control-height)] w-full min-w-[150px] cursor-pointer items-center justify-between gap-4 rounded-control border border-line bg-surface px-4 py-0 text-[.9rem] font-normal text-ink transition-[border-color,box-shadow,background] duration-150 hover:border-[color-mix(in_srgb,var(--brand)_42%,var(--line))] data-[state=open]:border-brand focus-visible:border-brand focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-faint motion-reduce:transition-none",
          compact &&
            "h-[38px] min-h-[38px] min-w-[138px] px-[.7rem] text-[.78rem] font-[650]",
          loading && loadingPlaceholder(true, "control"),
          className,
        )}
        data-placeholder={loading ? "control" : undefined}
        id={id}
      >
        <Select.Value placeholder={placeholder} />
        <Select.Icon>
          <ChevronDown aria-hidden="true" size={15} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className={cn(
            "z-[100] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[4px] border border-line bg-surface p-[.3rem] shadow-[0_18px_50px_color-mix(in_srgb,var(--brand-hover)_16%,transparent)] animate-[popover-enter_160ms_ease-out] motion-reduce:animate-none",
            compact && "rounded-[3px] p-1",
          )}
          position="popper"
          sideOffset={6}
        >
          <Select.Viewport className="grid gap-[var(--space-1)]">
            {options.map((option) => (
              <Select.Item
                className="flex min-h-[38px] cursor-pointer select-none items-center justify-between rounded-[2px] px-[.65rem] py-[.55rem] text-[.8rem] text-ink data-[highlighted]:bg-brand-soft data-[highlighted]:text-brand data-[state=checked]:font-[650]"
                key={option.value}
                value={option.value}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check aria-hidden="true" size={14} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
