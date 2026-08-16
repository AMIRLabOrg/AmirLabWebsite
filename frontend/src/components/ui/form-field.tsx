import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FormField({
  children,
  className,
  description,
  htmlFor,
  label,
  labelClassName,
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  htmlFor?: string;
  label?: ReactNode;
  labelClassName?: string;
}) {
  return (
    <div className={cn("field grid content-start gap-[.45rem]", className)}>
      {label ? (
        htmlFor ? (
          <label className={labelClassName} htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className={labelClassName}>{label}</span>
        )
      ) : null}
      {children}
      {description ? (
        <p className="m-0 text-[.82rem] leading-[1.5] text-ink-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function FormMessage({
  children,
  tone = "error",
}: {
  children: ReactNode;
  tone?: "error" | "info" | "muted" | "success";
}) {
  return (
    <p
      className={cn(
        "m-0 text-[.82rem] leading-[1.5]",
        tone === "error" &&
          "rounded-panel bg-danger-soft p-[.8rem] text-danger",
        tone === "success" &&
          "rounded-panel bg-success-soft p-[.8rem] text-success",
        tone === "info" && "rounded-panel bg-info-soft p-[.8rem] text-info",
        tone === "muted" && "text-ink-muted",
      )}
      role={
        tone === "error"
          ? "alert"
          : tone === "success" || tone === "info"
            ? "status"
            : undefined
      }
    >
      {children}
    </p>
  );
}
