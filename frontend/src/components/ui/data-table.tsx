import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/cn";

export function DataTableShell({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={cn("grid min-w-0 gap-4", className)} {...props} />;
}

export function DataTableCard({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-x-auto rounded-panel border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function DataTable({
  className,
  ...props
}: ComponentPropsWithoutRef<"table">) {
  return (
    <table
      className={cn(
        "w-full min-w-[850px] border-collapse text-[.82rem]",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableHeadCell({
  className,
  ...props
}: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      className={cn(
        "border-b border-table-line px-[.9rem] py-3 text-left font-mono text-[.64rem] font-medium uppercase tracking-[.06em] text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableCell({
  className,
  ...props
}: ComponentPropsWithoutRef<"td">) {
  return (
    <td
      className={cn(
        "border-b border-line px-[.9rem] py-[.85rem] align-middle",
        className,
      )}
      {...props}
    />
  );
}

export function DataTableRow({
  className,
  clickable = false,
  ...props
}: ComponentPropsWithoutRef<"tr"> & { clickable?: boolean }) {
  return (
    <tr
      className={cn(
        "last:[&>td]:border-b-0 hover:[&>td]:bg-canvas",
        clickable &&
          "cursor-pointer focus-visible:outline-none focus-visible:[&>td]:bg-brand-faint",
        className,
      )}
      {...props}
    />
  );
}
