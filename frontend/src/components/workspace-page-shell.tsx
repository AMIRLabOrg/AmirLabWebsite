import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

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
        "mx-auto w-full max-w-[1280px] px-[clamp(1rem,3vw,2.5rem)] py-6 pb-14 max-[820px]:px-0",
        className,
      )}
    >
      {headVisible ? (
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-line pb-6 max-[640px]:items-start max-[640px]:flex-col">
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
