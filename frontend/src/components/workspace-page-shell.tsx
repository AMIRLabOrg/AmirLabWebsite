import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { WorkspaceFrameNodes } from "@/components/ui/workspace-surface";

interface WorkspacePageShellProps {
  children: ReactNode;
  className?: string;
  description?: string;
  action?: ReactNode;
}

export function WorkspacePageShell({
  children,
  className,
  description,
  action,
}: WorkspacePageShellProps) {
  const headVisible = description || action;
  return (
    <section
      className={cn(
        "relative z-[1] mx-auto min-h-[calc(100svh-52px)] w-full max-w-[var(--workspace-wide)] px-[var(--workspace-gutter)] pt-6 pb-14 max-[820px]:min-h-0 max-[820px]:px-0",
        className,
      )}
    >
      {headVisible ? (
        <div className="relative mx-[calc(var(--workspace-gutter)*-1)] mb-6 flex items-center justify-between gap-4 border-b border-line-strong px-[var(--workspace-gutter)] pb-6 max-[640px]:flex-col max-[640px]:items-start">
          <WorkspaceFrameNodes edge="bottom" />
          {description ? (
            <p className="m-0 max-w-[640px] text-[.82rem] leading-[1.55] text-ink-muted">
              {description}
            </p>
          ) : (
            <span />
          )}
          {action ?? null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
