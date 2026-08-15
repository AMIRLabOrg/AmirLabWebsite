import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

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

export function WorkspaceRecordForm({ className, ...props }: ComponentPropsWithoutRef<"form">) {
  return <form className={cn("mx-auto grid w-full max-w-[820px] gap-[1.35rem] rounded-panel border border-line bg-surface p-[clamp(1.25rem,3vw,2rem)]", className)} {...props} />;
}

export function WorkspaceRecordPanel({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={cn("mx-auto grid w-full max-w-[820px] gap-[1.35rem] rounded-panel border border-line bg-surface p-[clamp(1.25rem,3vw,2rem)]", className)} {...props} />;
}

export function WorkspaceRecordPanelHeader({ className, ...props }: ComponentPropsWithoutRef<"header">) {
  return <header className={cn("grid gap-[.35rem] border-b border-line pb-[1.15rem]", className)} {...props} />;
}

export function WorkspaceRecordPanelTitle({ className, ...props }: ComponentPropsWithoutRef<"h2">) {
  return <h2 className={cn("m-0 font-serif text-[clamp(1.4rem,2.4vw,2rem)] font-normal leading-[1.1]", className)} {...props} />;
}

export function WorkspaceRecord({ actions, backHref, backLabel, children, description, eyebrow, loading = false, title }: WorkspaceRecordProps) {
  return (
    <div className="mx-auto grid w-full max-w-[1280px] gap-6 pb-20" data-loading={loading || undefined}>
      <Link className="inline-flex w-fit items-center gap-[.4rem] text-[.86rem] text-ink-muted hover:text-brand" href={backHref}>
        <ArrowLeft aria-hidden="true" size={15} /> {backLabel}
      </Link>
      <header className="flex items-end justify-between gap-4 border-b border-line pb-6 max-[700px]:flex-col max-[700px]:items-stretch">
        <div>
          <p className="m-0 mb-4 font-[var(--font-sans)] text-[.75rem] font-extrabold uppercase tracking-[.12em] text-brand">{eyebrow}</p>
          <h1 className={cn("mt-[.3rem] font-serif text-[clamp(2.15rem,4.6vw,3.65rem)] font-normal leading-[.98] tracking-[-.035em]", loadingPlaceholder(loading, "text", "long"))} data-placeholder={loading ? "text" : undefined} data-placeholder-width="long">{title}</h1>
          {description ? <p className="mt-[.7rem] max-w-[640px] text-[.88rem] leading-[1.55] text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap justify-end gap-[.65rem] max-[700px]:justify-start">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
