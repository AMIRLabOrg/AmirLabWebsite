import { cn } from "@/lib/cn";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  WorkspaceHero,
  WorkspaceRuleBand,
} from "@/components/ui/workspace-surface";

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

export function WorkspaceBackLink({
  children,
  ...props
}: ComponentPropsWithoutRef<typeof Link>) {
  return (
    <div className="workspace-back-link py-3">
      <Link
        {...props}
        className="inline-flex min-h-10 items-center gap-2 rounded-control px-3 text-[.76rem] font-medium text-ink-muted hover:bg-surface-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
      >
        <ArrowLeft aria-hidden="true" size={15} /> {children}
      </Link>
    </div>
  );
}

export function WorkspaceRecordForm({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"form">) {
  return (
    <form className="relative" {...props}>
      <WorkspaceRuleBand
        contentClassName={cn("grid w-full gap-[1.35rem] py-6", className)}
      >
        {children}
      </WorkspaceRuleBand>
    </form>
  );
}

export function WorkspaceRecordPanel({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"section">) {
  return (
    <WorkspaceRuleBand
      className={className}
      contentClassName="grid w-full gap-[1.35rem] py-6"
      {...props}
    >
      {children}
    </WorkspaceRuleBand>
  );
}

export function WorkspaceRecordPanelHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<"header">) {
  return (
    <header
      className={cn(
        "-mx-[var(--workspace-gutter)] grid gap-[.35rem] border-b border-line px-[var(--workspace-gutter)] pb-[1.15rem]",
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
      className="grid w-full gap-0 pb-20"
      data-loading={loading || undefined}
    >
      <WorkspaceBackLink href={backHref}>{backLabel}</WorkspaceBackLink>
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
