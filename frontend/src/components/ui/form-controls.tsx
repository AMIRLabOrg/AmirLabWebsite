import { forwardRef } from "react";
import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export const formControlClass = "h-[var(--control-height)] min-h-[var(--control-height)] w-full rounded-control border border-line bg-surface px-4 py-0 text-[.9rem] font-normal leading-[1.45] text-ink transition-[border-color,box-shadow,background] duration-150 hover:not-disabled:border-[color-mix(in_srgb,var(--brand)_42%,var(--line))] focus-visible:border-brand focus-visible:shadow-[var(--focus-ring)] aria-invalid:border-danger disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-faint motion-reduce:transition-none";

export const InputControl = forwardRef<HTMLInputElement, ComponentPropsWithRef<"input"> & { loading?: boolean }>(
  function InputControl({ className, loading = false, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(formControlClass, loading && loadingPlaceholder(true, "control"), className)}
        data-placeholder={loading ? "control" : props["data-placeholder"]}
        {...props}
      />
    );
  }
);

export const TextareaControl = forwardRef<
  HTMLTextAreaElement,
  ComponentPropsWithRef<"textarea"> & { loading?: boolean }
>(function TextareaControl({ className, loading = false, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(formControlClass, "h-auto min-h-[120px] resize-y rounded-panel py-3", loading && loadingPlaceholder(true, "control"), className)}
      data-placeholder={loading ? "control" : props["data-placeholder"]}
      {...props}
    />
  );
});

export const FileInputControl = forwardRef<
  HTMLInputElement,
  Omit<ComponentPropsWithRef<"input">, "type"> & { loading?: boolean }
>(function FileInputControl({ className, loading = false, ...props }, ref) {
  return (
    <InputControl
      ref={ref}
      className={cn("hidden", className)}
      loading={loading}
      type="file"
      {...props}
    />
  );
});
