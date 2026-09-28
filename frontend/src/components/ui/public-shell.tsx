import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PublicShell({
  as: Component = "div",
  className,
  children,
  ...props
}: { as?: ElementType; className?: string; children: ReactNode } & Omit<
  ComponentPropsWithoutRef<"div">,
  "children"
>) {
  return (
    <Component
      className={cn(
        "mx-auto w-full max-w-[var(--public-wide)] px-[var(--public-gutter)]",
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}

type FrameBoundary = "none" | "top" | "bottom" | "both";

export function FrameIntersectionNode({
  className,
  nodeSurfaceClassName = "bg-canvas",
  ...props
}: ComponentPropsWithoutRef<"span"> & {
  nodeSurfaceClassName?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "z-20 h-1.5 w-1.5 border border-line-strong shadow-[0_0_0_1px_var(--canvas)]",
        nodeSurfaceClassName,
        className,
      )}
      {...props}
    />
  );
}

/**
 * The shared outer frame for a public page section. It owns viewport rules and
 * the centered content gutter so pages never draw those lines themselves.
 */
export function PublicSection({
  as: Component = "section",
  boundary = "none",
  children,
  className,
  contentClassName,
  nodeSurfaceClassName = "bg-canvas",
  ...props
}: {
  as?: "div" | "header" | "section";
  boundary?: FrameBoundary;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  nodeSurfaceClassName?: string;
} & Omit<ComponentPropsWithoutRef<"section">, "children" | "className">) {
  const top = boundary === "top" || boundary === "both";
  const bottom = boundary === "bottom" || boundary === "both";

  return (
    <Component
      className={cn(
        "relative",
        top && "border-t border-line-strong lg:border-t-0",
        bottom && "border-b border-line-strong lg:border-b-0",
        className,
      )}
      {...props}
    >
      {top ? (
        <FrameRule edge="top" nodeSurfaceClassName={nodeSurfaceClassName} />
      ) : null}
      <PublicShell className={cn("relative", contentClassName)}>
        {children}
      </PublicShell>
      {bottom ? (
        <FrameRule edge="bottom" nodeSurfaceClassName={nodeSurfaceClassName} />
      ) : null}
    </Component>
  );
}

/** Extends a child collection from the padded content area to both rails. */
export function FramedCollection({
  children,
  className,
  topRule = false,
}: {
  children: ReactNode;
  className?: string;
  topRule?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative mx-[calc(var(--public-gutter)*-1)]",
        topRule && "border-t border-line-strong",
        className,
      )}
    >
      {topRule ? <FrameNodes edge="top" /> : null}
      {children}
    </div>
  );
}

/** A connected row inside a FramedCollection. */
export function FramedRow({
  as: Component = "div",
  bleed = false,
  children,
  className,
  rule = true,
  ...props
}: {
  as?: "article" | "div" | "header";
  bleed?: boolean;
  children: ReactNode;
  className?: string;
  rule?: boolean;
} & Omit<ComponentPropsWithoutRef<"article">, "children" | "className">) {
  return (
    <Component
      className={cn(
        "relative",
        rule && "border-b border-line-strong",
        bleed && "mx-[calc(var(--public-gutter)*-1)]",
        className,
      )}
      {...props}
    >
      {rule ? <FrameNodes className="z-10" edge="bottom" /> : null}
      {children}
    </Component>
  );
}

export function FrameRails({
  className,
  mode = "page",
}: {
  className?: string;
  mode?: "page" | "content";
}) {
  if (mode === "content") {
    return (
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-y-0 left-1/2 z-0 hidden w-full max-w-[var(--public-wide)] -translate-x-1/2 border-x border-line-strong min-[641px]:block",
          className,
        )}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 hidden overflow-hidden lg:block",
        className,
      )}
    >
      <i className="absolute inset-y-0 left-[4.25%] border-l border-dashed border-line-strong/45" />
      <div className="absolute inset-x-0 inset-y-0 mx-auto w-full max-w-[var(--public-wide)] border-x border-line-strong/60" />
      <i className="absolute inset-y-0 right-[5.4%] border-l border-dashed border-line-strong/45" />
    </div>
  );
}

export function FrameRuleNodes({
  className,
  scope = "viewport",
  nodeSurfaceClassName = "bg-canvas",
}: {
  className?: string;
  scope?: "viewport" | "contained";
  nodeSurfaceClassName?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 hidden lg:block",
        className,
      )}
    >
      {scope === "viewport" ? (
        <>
          <FrameIntersectionNode
            className="absolute left-[4.25%] top-0 -translate-x-1/2 -translate-y-1/2"
            nodeSurfaceClassName={nodeSurfaceClassName}
          />
          <FrameIntersectionNode
            className="absolute top-0 right-[5.4%] translate-x-1/2 -translate-y-1/2"
            nodeSurfaceClassName={nodeSurfaceClassName}
          />
        </>
      ) : null}
      <div
        className={cn(
          "absolute inset-x-0 top-0 mx-auto h-0 w-full",
          scope === "viewport" && "max-w-[var(--public-wide)]",
        )}
      >
        <FrameIntersectionNode
          className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2"
          nodeSurfaceClassName={nodeSurfaceClassName}
        />
        <FrameIntersectionNode
          className="absolute top-0 right-0 translate-x-1/2 -translate-y-1/2"
          nodeSurfaceClassName={nodeSurfaceClassName}
        />
      </div>
    </div>
  );
}

export function FrameRule({
  className,
  edge = "bottom",
  scope = "viewport",
  nodeSurfaceClassName = "bg-canvas",
}: {
  className?: string;
  edge?: "top" | "bottom";
  scope?: "viewport" | "contained";
  nodeSurfaceClassName?: string;
}) {
  const nodePosition = edge === "top" ? "top-0" : "bottom-0";
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-x-0 z-10 hidden h-0 lg:block",
        edge === "top" ? "top-0" : "bottom-0",
        className,
      )}
      style={
        scope === "viewport"
          ? {
              left: "calc((100% - 100cqw) / 2)",
              right: "calc((100% - 100cqw) / 2)",
            }
          : undefined
      }
    >
      <span
        className={cn(
          "absolute inset-x-0 border-t border-line-strong",
          nodePosition,
        )}
      />
      <FrameRuleNodes
        className={nodePosition}
        scope={scope}
        nodeSurfaceClassName={nodeSurfaceClassName}
      />
    </div>
  );
}

export function FrameNodes({
  className,
  edge = "both",
  nodeSurfaceClassName = "bg-canvas",
}: {
  className?: string;
  edge?: "top" | "bottom" | "both";
  nodeSurfaceClassName?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 hidden min-[641px]:block",
        className,
      )}
    >
      {edge !== "bottom" ? (
        <>
          <FrameIntersectionNode
            className="absolute top-[-.5px] left-0 -translate-x-1/2 -translate-y-1/2"
            nodeSurfaceClassName={nodeSurfaceClassName}
          />
          <FrameIntersectionNode
            className="absolute top-[-.5px] right-0 translate-x-1/2 -translate-y-1/2"
            nodeSurfaceClassName={nodeSurfaceClassName}
          />
        </>
      ) : null}
      {edge !== "top" ? (
        <>
          <FrameIntersectionNode
            className="absolute bottom-[-.5px] left-0 -translate-x-1/2 translate-y-1/2"
            nodeSurfaceClassName={nodeSurfaceClassName}
          />
          <FrameIntersectionNode
            className="absolute right-0 bottom-[-.5px] translate-x-1/2 translate-y-1/2"
            nodeSurfaceClassName={nodeSurfaceClassName}
          />
        </>
      ) : null}
    </div>
  );
}

export function Eyebrow({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"p"> & {
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "mb-[.65rem] font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase",
        className,
      )}
      {...props}
    >
      {children}
    </p>
  );
}
