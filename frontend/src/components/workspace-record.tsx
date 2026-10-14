import { cn } from "@/lib/cn";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { WorkspaceHero } from "@/components/ui/workspace-surface";

interface WorkspaceRecordProps {
  actions?: ReactNode;
  backHref: string;
  backLabel: string;
  children: ReactNode;
  description?: string;
  eyebrow: string;
  loading?: boolean;
  title: string;
}

export function WorkspaceRecordForm({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"form">) {
  return (
    <form className="relative border border-line-strong bg-surface" {...props}>
      <div
        className={cn(
          "grid w-full gap-[1.35rem] px-[var(--workspace-gutter)] py-5",
          className,
        )}
      >
        {children}
      </div>
    </form>
  );
}

export function WorkspaceRecordPanel({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn("relative border border-line-strong bg-surface", className)}
      {...props}
    >
      <div className="grid w-full gap-[1.35rem] px-[var(--workspace-gutter)] py-5">
        {children}
      </div>
    </section>
  );
}

export function WorkspaceRecordPanelHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"header">) {
  return (
    <header
      className={cn(
        "grid gap-[.35rem] border-b border-line pb-[1.15rem]",
        className,
      )}
      {...props}
    />
  );
}

export function WorkspaceRecordPanelTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<"h2">) {
  return (
    <h2
      className={cn(
        "m-0 font-sans text-[1.2rem] font-medium leading-[1.15]",
        className,
      )}
      {...props}
    />
  );
}

export function WorkspaceRecord({
  actions,
  backHref,
  backLabel,
  children,
  description,
  eyebrow,
  loading = false,
  title,
}: WorkspaceRecordProps) {
  return (
    <div
      className="grid w-full gap-6 pb-20"
      data-loading={loading || undefined}
    >
      <Link
        className="inline-flex w-fit items-center gap-[.35rem] text-[.72rem] font-medium text-ink-muted hover:text-brand"
        href={backHref}
      >
        <ArrowLeft aria-hidden="true" size={15} /> {backLabel}
      </Link>
      <WorkspaceHero
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={actions}
        loading={loading}
      />
      {children}
    </div>
  );
}
