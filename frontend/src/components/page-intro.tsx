import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { PublicSection } from "@/components/ui/public-shell";
import { loadingPlaceholder } from "@/lib/loading-style";

export function PageIntro({
  children,
  eyebrow,
  meta,
  title,
  loading = false,
}: {
  children: ReactNode;
  eyebrow: string;
  meta?: ReactNode;
  title: string;
  loading?: boolean;
}) {
  return (
    <PublicSection
      as="header"
      aria-busy={loading || undefined}
      boundary="bottom"
      contentClassName="grid min-h-[220px] grid-cols-[minmax(0,1fr)] items-stretch pt-[clamp(2.3rem,4.5vw,4.2rem)] pb-[2.2rem] max-[640px]:min-h-0 max-[640px]:pt-8 max-[640px]:pb-6"
      data-loading={loading || undefined}
    >
      <div className="self-center min-w-0">
        <p
          aria-hidden={loading || undefined}
          className={cn(
            "mb-[.65rem] font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase",
            loading && loadingPlaceholder(true, "label", "medium"),
          )}
          data-placeholder={loading ? "label" : undefined}
        >
          {eyebrow}
        </p>
        <h1
          aria-hidden={loading || undefined}
          className={cn(
            "m-0 max-w-[850px] text-[clamp(2.8rem,5vw,4.7rem)] leading-[.92] font-medium tracking-[-.055em] max-[640px]:text-[clamp(2.45rem,13vw,3.45rem)]",
            "font-sans",
            loading && loadingPlaceholder(true, "text", "medium"),
          )}
          data-placeholder={loading ? "text" : undefined}
        >
          {title}
        </h1>
        <p
          aria-hidden={loading || undefined}
          className={cn(
            "mt-4 mb-0 max-w-[720px] text-[.88rem] leading-[1.65] text-ink-muted max-[640px]:text-[.82rem]",
            loading && loadingPlaceholder(true, "text", "long"),
          )}
          data-placeholder={loading ? "text" : undefined}
        >
          {children}
        </p>
        {meta ? (
          <div
            aria-hidden={loading || undefined}
            className="mt-[1.35rem] flex flex-wrap gap-x-[1.2rem] gap-y-2 font-mono text-[.6rem] text-ink-muted"
          >
            {loading ? (
              <>
                <span className={loadingPlaceholder(true, "text", "short")} />
                <span className={loadingPlaceholder(true, "text", "medium")} />
                <span className={loadingPlaceholder(true, "text", "short")} />
              </>
            ) : (
              meta
            )}
          </div>
        ) : null}
      </div>
    </PublicSection>
  );
}
