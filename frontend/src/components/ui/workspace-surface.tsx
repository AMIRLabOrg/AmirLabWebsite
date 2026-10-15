import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { FrameRule } from "@/components/ui/public-shell";

/**
 * The workspace content box. Its edges are the workspace rails at every width
 * (see --frame-inner with --frame-wide: var(--workspace-wide)).
 */
export const workspaceShellClass =
  "mx-auto w-full max-w-[min(var(--workspace-wide),calc(100%_-_2*var(--frame-mobile-inner)))] px-[var(--workspace-gutter)]";

function WorkspaceSection({
  as: Component = "section",
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  as?: "section" | "header" | "div";
}) {
  return (
    <Component
      className={cn("frame-rail-section min-w-0", className)}
      {...props}
    >
      <FrameRule
        className="frame-rule-start [--frame-inner:0px]"
        edge="top"
        scope="parent"
      />
      {children}
      <FrameRule
        className="frame-rule-end [--frame-inner:0px]"
        edge="bottom"
        scope="parent"
      />
    </Component>
  );
}

export function WorkspaceSurface({
  children,
}: {
  children: ReactNode;
  measure?: "form" | "reading" | "wide";
}) {
  return (
    <main
      className={cn(
        workspaceShellClass,
        "frame-surface relative grid content-start min-h-[calc(100svh-64px)] gap-0 pb-12 max-[820px]:min-h-0 max-[640px]:pb-10",
      )}
    >
      {children}
    </main>
  );
}

export function WorkspaceHero({
  action,
  description,
  eyebrow,
  meta,
  loading = false,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  eyebrow: ReactNode;
  meta?: ReactNode;
  loading?: boolean;
  title: ReactNode;
}) {
  return (
    <WorkspaceSection
      as="header"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-5 py-8 max-[640px]:grid-cols-1 max-[640px]:items-start"
      data-loading={loading || undefined}
    >
      <div className="min-w-0">
        <p className="mb-[.42rem] font-mono text-[.61rem] font-semibold tracking-[.11em] text-brand uppercase">
          {eyebrow}
        </p>
        <h1
          className={cn(
            "m-0 break-words font-serif text-[clamp(1.7rem,3vw,2.35rem)] leading-[1.02] font-medium tracking-[-.03em]",
            loadingPlaceholder(loading, "text", "long"),
          )}
          data-placeholder={loading ? "text" : undefined}
          data-placeholder-width="long"
        >
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              "mt-[.65rem] mb-0 max-w-[700px] text-[.76rem] leading-[1.55] text-ink-muted",
              loadingPlaceholder(loading, "text", "long"),
            )}
            data-placeholder={loading ? "text" : undefined}
            data-placeholder-width="long"
          >
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
        <div className="flex max-w-full flex-wrap items-center justify-end gap-[.65rem] max-[640px]:justify-start">
          {action}
        </div>
      ) : null}
    </WorkspaceSection>
  );
}

export function WorkspacePanel({
  action,
  children,
  compact = false,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <WorkspaceSection className="frame-panel !px-0">
      <span
        aria-hidden="true"
        className="frame-node frame-split-node absolute left-[var(--frame-node-offset)] top-[var(--frame-node-offset)]"
      />
      <span
        aria-hidden="true"
        className="frame-node frame-split-node absolute left-[var(--frame-node-offset)] bottom-[var(--frame-node-offset)]"
      />
      <header
        className={cn(
          "flex items-start justify-between gap-[1.2rem] border-b border-line px-[var(--workspace-gutter)] max-[640px]:flex-col",
          compact ? "py-3" : "py-6",
        )}
      >
        <div className="min-w-0 flex-1">
          {eyebrow ? (
            <p className="mb-[.42rem] font-mono text-[.61rem] font-semibold tracking-[.11em] text-brand uppercase">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="m-0 font-sans text-[1.2rem] leading-[1.15] font-medium">
            {title}
          </h2>
          {description ? (
            <p className="mt-[.3rem] mb-0 max-w-[640px] text-[.7rem] leading-[1.45] text-ink-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="max-w-full shrink-0">{action}</div> : null}
      </header>
      {children}
    </WorkspaceSection>
  );
}

export function WorkspaceFacts({
  className,
  ...props
}: ComponentPropsWithoutRef<"dl">) {
  return (
    <dl
      className={cn(
        "m-0 grid grid-cols-5 gap-x-5 gap-y-4 px-[var(--workspace-gutter)] py-4 max-[900px]:grid-cols-3 max-[640px]:grid-cols-2 [&>div]:min-w-0 [&_dt]:mb-1 [&_dt]:font-mono [&_dt]:text-[.59rem] [&_dt]:leading-relaxed [&_dt]:text-ink-muted [&_dd]:m-0 [&_dd]:text-[.8rem] [&_dd]:font-medium [&_dd]:leading-snug",
        className,
      )}
      {...props}
    />
  );
}

export function WorkspaceMetricStrip({ children }: { children: ReactNode }) {
  return (
    <WorkspaceSection className="grid grid-cols-4 !px-0 max-[900px]:grid-cols-2">
      {children}
    </WorkspaceSection>
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
        "relative grid min-w-0 gap-1 border-l border-line px-[var(--workspace-gutter)] pt-[.8rem] pb-[.9rem] first:border-l-0 before:absolute before:inset-x-0 before:top-0 before:h-0.5 before:content-[''] max-[900px]:nth-3:border-l-0 max-[900px]:nth-3:border-t max-[900px]:nth-4:border-t max-[640px]:px-[.8rem] max-[640px]:py-[.7rem]",
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
    <WorkspaceSection
      as="div"
      className="frame-split grid grid-cols-[minmax(0,1.22fr)_minmax(320px,.78fr)] !px-0 max-[900px]:grid-cols-1"
    >
      {children}
    </WorkspaceSection>
  );
}

export function WorkspaceEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[110px] place-content-center justify-items-start px-[var(--workspace-gutter)] py-8 text-[.74rem] leading-[1.5] text-ink-muted">
      {children}
    </div>
  );
}

/**
 * A workspace band aligned to the page rails. Child content owns its gutter.
 */
export function WorkspaceRuleBand({
  children,
  className,
  contentClassName,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  contentClassName?: string;
}) {
  return (
    <WorkspaceSection className={cn("!px-0", className)} {...props}>
      <div
        className={cn("min-w-0 px-[var(--workspace-gutter)]", contentClassName)}
      >
        {children}
      </div>
    </WorkspaceSection>
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
  inset = true,
  ...props
}: ComponentPropsWithoutRef<"div"> & { inset?: boolean }) {
  return (
    <div className="relative border-b border-line last:border-b-0" {...props}>
      <div className={cn("min-w-0", inset && "px-[var(--workspace-gutter)]")}>
        <div className={cn("min-w-0", className)}>{children}</div>
      </div>
    </div>
  );
}

// Both panes stay in view on desktop and scroll internally (RULES §7).
const reviewPane =
  "sticky top-[88px] max-h-[calc(100svh-104px)] min-w-0 overflow-y-auto max-[960px]:static max-[960px]:max-h-none max-[960px]:overflow-visible";

/**
 * The master/detail card shared by every review queue: the queue pane on the
 * left, the open record on the right. The detail pane is a size container so
 * record layouts adapt to the pane, not the viewport.
 */
export function ReviewSplit({
  detail,
  detailLoading = false,
  dimQueue = false,
  queue,
}: {
  detail: ReactNode;
  detailLoading?: boolean;
  dimQueue?: boolean;
  queue: ReactNode;
}) {
  return (
    <WorkspaceRuleBand contentClassName="grid min-w-0 grid-cols-[minmax(300px,392px)_minmax(0,1fr)] items-start !px-0 max-[960px]:grid-cols-1">
      <aside
        className={cn(
          reviewPane,
          "grid content-start border-r border-line max-[960px]:border-r-0 max-[960px]:border-b",
          dimQueue && "opacity-70",
        )}
      >
        {queue}
      </aside>
      <section
        className={cn(
          reviewPane,
          "@container grid content-start gap-4 p-5 max-[960px]:px-[var(--workspace-gutter)]",
        )}
        data-loading={detailLoading || undefined}
      >
        {detail}
      </section>
    </WorkspaceRuleBand>
  );
}
