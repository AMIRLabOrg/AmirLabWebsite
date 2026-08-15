import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

const measureClass = {
  wide: "max-w-[var(--workspace-wide)]",
  reading: "max-w-[var(--workspace-reading)]",
  form: "max-w-[var(--workspace-form)]",
} as const;

export function WorkspaceSurface({ children, measure = "reading" }: { children: ReactNode; measure?: keyof typeof measureClass }) {
  return <main className={cn("mx-auto grid w-full gap-[1.15rem] px-[clamp(1rem,2.4vw,2rem)] pt-[1.4rem] pb-12 max-[640px]:gap-[.9rem] max-[640px]:px-0 max-[640px]:pt-4 max-[640px]:pb-10", measureClass[measure])}>{children}</main>;
}

export function WorkspaceHero({ action, description, eyebrow, meta, title }: { action?: ReactNode; description?: ReactNode; eyebrow: ReactNode; meta?: ReactNode; title: ReactNode }) {
  return (
    <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-5 border-b border-line-strong pt-[.4rem] pb-[1.15rem] max-[640px]:grid-cols-1 max-[640px]:items-start">
      <div className="min-w-0">
        <p className="mb-[.42rem] font-mono text-[.61rem] font-semibold tracking-[.11em] text-brand uppercase">{eyebrow}</p>
        <h1 className="m-0 font-serif text-[clamp(2rem,3.5vw,3.15rem)] leading-none font-medium tracking-[-.04em] max-[640px]:text-[clamp(2rem,11vw,2.75rem)]">{title}</h1>
        {description ? <p className="mt-[.65rem] mb-0 max-w-[760px] text-[.78rem] leading-[1.55] text-ink-muted">{description}</p> : null}
        {meta ? <div className="mt-[.7rem] flex flex-wrap gap-x-[1.2rem] gap-y-[.35rem] font-mono text-[.59rem] text-ink-muted uppercase">{meta}</div> : null}
      </div>
      {action ? <div className="flex shrink-0 items-center max-[640px]:w-full max-[640px]:[&>*]:w-full">{action}</div> : null}
    </header>
  );
}

export function WorkspacePanel({ action, children, description, eyebrow, title }: { action?: ReactNode; children: ReactNode; description?: ReactNode; eyebrow?: ReactNode; title: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden border-y border-line bg-surface">
      <header className="flex items-start justify-between gap-[1.2rem] border-b border-line px-4 py-[.9rem] max-[640px]:flex-col max-[640px]:p-[.8rem]">
        <div>
          {eyebrow ? <p className="mb-[.42rem] font-mono text-[.61rem] font-semibold tracking-[.11em] text-brand uppercase">{eyebrow}</p> : null}
          <h2 className="m-0 font-serif text-[1.2rem] leading-[1.1] font-medium tracking-[-.018em]">{title}</h2>
          {description ? <p className="mt-[.3rem] mb-0 max-w-[640px] text-[.7rem] leading-[1.45] text-ink-muted">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function WorkspaceMetricStrip({ children }: { children: ReactNode }) {
  return <section className="grid grid-cols-4 overflow-hidden border-y border-line-strong max-[900px]:grid-cols-2">{children}</section>;
}

export function WorkspaceMetric({ detail, label, loading = false, tone = "neutral", value }: { detail: ReactNode; label: ReactNode; loading?: boolean; tone?: "attention" | "brand" | "neutral" | "success"; value: ReactNode }) {
  const toneTop = tone === "brand" ? "before:bg-brand" : tone === "attention" ? "before:bg-danger" : tone === "success" ? "before:bg-success" : "before:bg-line";
  return (
    <article className={cn("relative grid min-w-0 gap-1 border-l border-line px-4 pt-[.8rem] pb-[.9rem] first:border-l-0 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[''] max-[900px]:nth-3:border-l-0 max-[900px]:nth-3:border-t max-[900px]:nth-4:border-t max-[640px]:px-[.8rem] max-[640px]:py-[.7rem]", toneTop)} data-loading={loading || undefined}>
      <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[.55rem] tracking-[.08em] text-ink-muted uppercase">{label}</span>
      <strong className={cn("font-mono text-[1.35rem] leading-[1.05] font-medium", loading && loadingPlaceholder(true, "value", "short"))} data-placeholder={loading ? "value" : undefined} data-placeholder-width="short">{value}</strong>
      <small className="text-[.64rem] leading-[1.35] text-ink-muted">{detail}</small>
    </article>
  );
}

export function WorkspaceSplit({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-[minmax(0,1.22fr)_minmax(320px,.78fr)] items-start gap-[1.15rem] max-[900px]:grid-cols-1">{children}</div>;
}

export function WorkspaceEmpty({ children }: { children: ReactNode }) {
  return <div className="grid min-h-[110px] place-content-center justify-items-start p-4 text-[.74rem] leading-[1.5] text-ink-muted">{children}</div>;
}
