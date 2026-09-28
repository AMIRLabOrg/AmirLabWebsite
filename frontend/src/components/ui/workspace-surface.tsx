import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

const measureClass = {
  wide: "max-w-[var(--workspace-wide)]",
  reading: "max-w-[var(--workspace-wide)]",
  form: "max-w-[var(--workspace-form)]",
} as const;

export function WorkspaceSurface({
  children,
  measure = "reading",
}: {
  children: ReactNode;
  measure?: keyof typeof measureClass;
}) {
  return (
    <main
      className={cn(
        "relative z-[1] mx-auto grid min-h-[calc(100svh-52px)] w-full gap-[1.15rem] px-[var(--workspace-gutter)] pt-[1.4rem] pb-12 max-[820px]:min-h-0 max-[640px]:gap-[.9rem] max-[640px]:px-0 max-[640px]:pt-4 max-[640px]:pb-10",
        measureClass[measure],
      )}
    >
      {children}
    </main>
  );
}

/**
 * One continuous frame owner for the entire workspace main column. Page
 * surfaces align to these rails but never redraw them.
 */
export function WorkspaceFrameRails({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-0 hidden overflow-hidden min-[821px]:block",
        className,
      )}
    >
      <i className="absolute inset-y-0 left-[4.25%] border-l border-dashed border-line-strong/45" />
      <div className="absolute inset-y-0 left-1/2 w-full max-w-[var(--workspace-wide)] -translate-x-1/2 border-x border-line-strong/70" />
      <i className="absolute inset-y-0 right-[5.4%] border-l border-dashed border-line-strong/45" />
    </div>
  );
}

export function WorkspaceRailRuleNodes({ className }: { className?: string }) {
  const node =
    "z-20 h-1.5 w-1.5 border border-line-strong bg-surface shadow-[0_0_0_1px_var(--canvas)]";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10 hidden min-[821px]:block",
        className,
      )}
    >
      <i
        className={cn(
          "absolute bottom-0 left-[4.25%] -translate-x-1/2 translate-y-1/2",
          node,
        )}
      />
      <i
        className={cn(
          "absolute right-[5.4%] bottom-0 translate-x-1/2 translate-y-1/2",
          node,
        )}
      />
      <span className="absolute inset-x-0 bottom-0 mx-auto h-0 w-full max-w-[var(--workspace-wide)]">
        <i
          className={cn(
            "absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
            node,
          )}
        />
        <i
          className={cn(
            "absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2",
            node,
          )}
        />
      </span>
    </span>
  );
}

export function WorkspaceHero({
  action,
  description,
  eyebrow,
  meta,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow: ReactNode;
  meta?: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="relative mx-[calc(var(--workspace-gutter)*-1)] grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-5 border-b border-line-strong px-[var(--workspace-gutter)] pt-[.4rem] pb-[1.15rem] max-[640px]:grid-cols-1 max-[640px]:items-start">
      <WorkspaceFrameNodes edge="bottom" />
      <div className="min-w-0">
        <p className="mb-[.42rem] font-mono text-[.61rem] font-semibold tracking-[.11em] text-brand uppercase">
          {eyebrow}
        </p>
        <h1 className="m-0 font-serif text-[clamp(2rem,3.5vw,3.15rem)] leading-none font-medium tracking-[-.04em] max-[640px]:text-[clamp(2rem,11vw,2.75rem)]">
          {title}
        </h1>
        {description ? (
          <p className="mt-[.65rem] mb-0 max-w-[760px] text-[.78rem] leading-[1.55] text-ink-muted">
            {description}
          </p>
        ) : null}
        {meta ? (
          <div className="mt-[.7rem] flex flex-wrap gap-x-[1.2rem] gap-y-[.35rem] font-mono text-[.59rem] text-ink-muted uppercase">
            {meta}
          </div>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center max-[640px]:w-full max-[640px]:[&>*]:w-full">
          {action}
        </div>
      ) : null}
    </header>
  );
}

export function WorkspacePanel({
  action,
  children,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className="relative min-w-0 border-y border-line-strong bg-transparent">
      <WorkspaceFrameNodes />
      <header className="flex items-start justify-between gap-[1.2rem] border-b border-line px-4 py-[.9rem] max-[640px]:flex-col max-[640px]:p-[.8rem]">
        <div>
          {eyebrow ? (
            <p className="mb-[.42rem] font-mono text-[.61rem] font-semibold tracking-[.11em] text-brand uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="m-0 font-serif text-[1.2rem] leading-[1.1] font-medium tracking-[-.018em]">
            {title}
          </h2>
          {description ? (
            <p className="mt-[.3rem] mb-0 max-w-[640px] text-[.7rem] leading-[1.45] text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div>{action}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function WorkspaceMetricStrip({ children }: { children: ReactNode }) {
  return (
    <section className="relative grid grid-cols-4 border-y border-line-strong bg-transparent max-[900px]:grid-cols-2">
      <WorkspaceFrameNodes />
      {children}
    </section>
  );
}

export function WorkspaceMetric({
  detail,
  label,
  loading = false,
  tone = "neutral",
  value,
}: {
  detail: ReactNode;
  label: ReactNode;
  loading?: boolean;
  tone?: "attention" | "brand" | "neutral" | "success";
  value: ReactNode;
}) {
  const toneTop =
    tone === "brand"
      ? "before:bg-brand"
      : tone === "attention"
        ? "before:bg-danger"
        : tone === "success"
          ? "before:bg-success"
          : "before:bg-line";
  return (
    <article
      className={cn(
        "relative grid min-w-0 gap-1 border-l border-line px-4 pt-[.8rem] pb-[.9rem] first:border-l-0 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[''] max-[900px]:nth-3:border-l-0 max-[900px]:nth-3:border-t max-[900px]:nth-4:border-t max-[640px]:px-[.8rem] max-[640px]:py-[.7rem]",
        toneTop,
      )}
      data-loading={loading || undefined}
    >
      <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[.55rem] tracking-[.08em] text-ink-muted uppercase">
        {label}
      </span>
      <strong
        className={cn(
          "font-mono text-[1.35rem] leading-[1.05] font-medium",
          loading && loadingPlaceholder(true, "value", "short"),
        )}
        data-placeholder={loading ? "value" : undefined}
        data-placeholder-width="short"
      >
        {value}
      </strong>
      <small className="text-[.64rem] leading-[1.35] text-ink-muted">
        {detail}
      </small>
    </article>
  );
}

export function WorkspaceSplit({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1.22fr)_minmax(320px,.78fr)] items-start gap-[1.15rem] max-[900px]:grid-cols-1">
      {children}
    </div>
  );
}

export function WorkspaceEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[110px] place-content-center justify-items-start p-4 text-[.74rem] leading-[1.5] text-ink-muted">
      {children}
    </div>
  );
}

export function WorkspaceFrameNodes({
  className,
  edge = "both",
  surfaceClassName = "bg-canvas",
}: {
  className?: string;
  edge?: "top" | "bottom" | "both";
  surfaceClassName?: string;
}) {
  const node = cn(
    "z-20 h-1.5 w-1.5 border border-line-strong shadow-[0_0_0_1px_var(--canvas)]",
    surfaceClassName,
  );
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 z-10 hidden min-[821px]:block",
        className,
      )}
    >
      {edge !== "bottom" ? (
        <>
          <i
            className={cn(
              "absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2",
              node,
            )}
          />
          <i
            className={cn(
              "absolute top-0 right-0 translate-x-1/2 -translate-y-1/2",
              node,
            )}
          />
        </>
      ) : null}
      {edge !== "top" ? (
        <>
          <i
            className={cn(
              "absolute bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
              node,
            )}
          />
          <i
            className={cn(
              "absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2",
              node,
            )}
          />
        </>
      ) : null}
    </span>
  );
}

/**
 * A major workspace band. Its rules meet the page rails while its contents
 * retain the shared workspace gutter. Child content must draw only its own
 * internal dividers, never another inset frame.
 */
export function WorkspaceRuleBand({
  children,
  className,
  contentClassName,
  edge = "both",
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  contentClassName?: string;
  edge?: "top" | "bottom" | "both";
}) {
  return (
    <section
      className={cn(
        "relative mx-[calc(var(--workspace-gutter)*-1)] min-w-0 border-y border-line-strong bg-transparent max-[640px]:mx-0",
        className,
      )}
      {...props}
    >
      <WorkspaceFrameNodes edge={edge} />
      <div
        className={cn(
          "min-w-0 px-[var(--workspace-gutter)] max-[640px]:px-0",
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function WorkspaceCollection({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <WorkspaceRuleBand
      className={className}
      contentClassName="grid !px-0"
      {...props}
    >
      {children}
    </WorkspaceRuleBand>
  );
}

export function WorkspaceRow({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className="relative border-b border-line-strong last:border-b-0"
      {...props}
    >
      <div className="min-w-0 px-[var(--workspace-gutter)] max-[640px]:px-0">
        <div className={cn("min-w-0", className)}>{children}</div>
      </div>
      <WorkspaceFrameNodes edge="bottom" />
    </div>
  );
}
