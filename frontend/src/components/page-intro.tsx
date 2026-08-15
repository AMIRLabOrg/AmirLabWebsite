import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function PageIntro({ aside, children, eyebrow, index, meta, title, loading = false }: { aside?: ReactNode; children: ReactNode; eyebrow: string; index?: string; meta?: ReactNode; title: string; loading?: boolean; }) {
  return (
    <header
      aria-busy={loading || undefined}
      className={cn(
        "relative mx-auto grid min-h-[220px] w-full max-w-[var(--public-wide)] grid-cols-[70px_minmax(0,1fr)] items-stretch border-b border-line-strong px-[clamp(1rem,3.2vw,3rem)] pt-[clamp(2.3rem,4.5vw,4.2rem)] pb-[2.2rem] max-[640px]:min-h-0 max-[640px]:grid-cols-[34px_minmax(0,1fr)] max-[640px]:px-4 max-[640px]:pt-8 max-[640px]:pb-6",
        aside && "grid-cols-[70px_minmax(0,1fr)_minmax(240px,31%)] max-[900px]:grid-cols-[52px_minmax(0,1fr)] max-[640px]:grid-cols-[34px_minmax(0,1fr)]",
      )}
      data-loading={loading || undefined}
    >
      <div className="mr-[clamp(1rem,2vw,2rem)] border-r border-line pt-[.18rem] font-mono text-[.58rem] tracking-[.09em] text-ink-faint uppercase [writing-mode:vertical-rl] rotate-180 max-[640px]:mr-3" aria-hidden="true"><span>{index ?? "AMIR / INDEX"}</span></div>
      <div className="self-center min-w-0">
        <p className="mb-[.65rem] font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase">{eyebrow}</p>
        <h1 className="m-0 max-w-[850px] font-serif text-[clamp(2.8rem,5vw,4.7rem)] leading-[.92] font-medium tracking-[-.055em] max-[640px]:text-[clamp(2.45rem,13vw,3.45rem)]">{title}</h1>
        <p className={cn("mt-4 mb-0 max-w-[720px] text-[.88rem] leading-[1.65] text-ink-muted max-[640px]:text-[.82rem]", loading && loadingPlaceholder(true, "text"))}>{children}</p>
        {meta ? <div className="mt-[1.35rem] flex flex-wrap gap-x-[1.2rem] gap-y-2 border-t border-dotted border-line-strong pt-[.65rem] font-mono text-[.6rem] text-ink-muted">{meta}</div> : null}
      </div>
      {aside ? <aside className="ml-[clamp(1.25rem,3vw,3.4rem)] grid min-w-0 self-stretch border-l border-line pl-[clamp(1.1rem,2.2vw,2.2rem)] max-[900px]:col-start-2 max-[900px]:mt-6 max-[900px]:ml-0 max-[900px]:border-t max-[900px]:border-l-0 max-[900px]:pt-4 max-[900px]:pl-0 max-[640px]:col-span-full max-[640px]:mt-[1.3rem]">{aside}</aside> : null}
    </header>
  );
}

export function IntroRegister({ items, title = "Research register", loading = false }: { items: Array<{ label: string; value: ReactNode }>; title?: string; loading?: boolean; }) {
  return (
    <section aria-busy={loading || undefined} aria-label={title} className="grid min-h-full content-start" data-loading={loading || undefined}>
      <header className="grid gap-[.12rem] border-t border-line-strong pt-[.62rem] pb-[.7rem]">
        <span className="font-mono text-[.56rem] tracking-[.08em] text-ink-faint uppercase">AMIRLab</span>
        <strong className="font-serif text-[1.1rem] font-medium">{title}</strong>
      </header>
      <dl className="m-0 max-[900px]:grid max-[900px]:grid-cols-2">
        {items.map((item) => (
          <div className="grid grid-cols-[minmax(80px,.8fr)_minmax(0,1.2fr)] items-baseline gap-3 border-t border-dotted border-line py-[.52rem] max-[900px]:block max-[900px]:pr-4" key={item.label}>
            <dt className="font-mono text-[.56rem] tracking-[.08em] text-ink-faint uppercase">{item.label}</dt>
            <dd className={cn("m-0 text-right font-serif text-[.84rem] max-[900px]:mt-1 max-[900px]:text-left", loading && loadingPlaceholder(true, "value"))} data-placeholder={loading ? "value" : undefined}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
