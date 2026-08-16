import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MotionScene } from "@/components/motion-scene";
import { ButtonLink } from "@/components/ui/button-control";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { DEFAULT_ABOUT_CONTENT } from "@/lib/site-content";
import type { AboutContent } from "@/lib/types";

const shell = "mx-auto w-full max-w-[var(--public-wide)] px-[clamp(1rem,3.2vw,3rem)] max-[640px]:px-4";
const eyebrow = "m-0 font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase";

export function AboutPageView({ content = DEFAULT_ABOUT_CONTENT, loading = false }: { content?: AboutContent; loading?: boolean }) {
  return (
    <div>
      <section aria-busy={loading || undefined} className={cn(shell, "relative grid min-h-[330px] grid-cols-[minmax(0,1.25fr)_minmax(300px,.65fr)] items-stretch gap-[clamp(2rem,5vw,5rem)] overflow-hidden border-b border-line-strong py-[clamp(2.5rem,5vw,4rem)] max-[820px]:min-h-0 max-[820px]:grid-cols-1 max-[640px]:pt-[2.2rem]")} data-loading={loading || undefined}>
        <MotionScene className="relative col-start-2 row-start-1 h-auto w-full self-center text-brand opacity-55 max-[820px]:col-start-1 max-[820px]:row-start-2 max-[820px]:max-w-[520px] max-[820px]:justify-self-end" variant="about" />
        <div className="relative z-[2] col-start-1 row-start-1 max-w-[820px] self-center">
          <p className={cn(eyebrow, "mb-0")}>{content.eyebrow}</p>
          <h1 className={cn("mt-3 mb-4 text-[clamp(2.5rem,5vw,4.7rem)] leading-[.95] font-[620] tracking-[-.055em] max-[640px]:text-[clamp(2.4rem,12vw,3.35rem)]", loadingPlaceholder(loading, "text"))} data-placeholder={loading ? "text" : undefined}>{content.title}</h1>
          <p className={cn("m-0 max-w-[650px] text-[.92rem] leading-[1.65] text-ink-muted", loadingPlaceholder(loading, "text"))} data-placeholder={loading ? "text" : undefined}>{content.introduction}</p>
        </div>
      </section>

      <section aria-label="AmirLab facts" className={cn(shell, "grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] border-b border-line-strong max-[640px]:grid-cols-1")} data-loading={loading || undefined}>
        {content.facts.map((fact, index) => (
          <div className={cn("grid gap-[.2rem] border-r border-line px-4 py-[.9rem] first:pl-0 last:border-r-0", "max-[640px]:border-r-0 max-[640px]:border-b max-[640px]:px-0 max-[640px]:py-3")} key={`${fact.label}-${index}`}>
            <span className="font-mono text-[.54rem] tracking-[.08em] text-ink-muted uppercase">{fact.label}</span>
            <strong className={cn("font-serif text-[1.05rem] font-medium", loadingPlaceholder(loading, "value"))} data-placeholder={loading ? "value" : undefined}>{fact.value}</strong>
          </div>
        ))}
      </section>

      <section className={cn(shell, "grid grid-cols-[minmax(150px,.28fr)_minmax(0,1fr)] gap-[clamp(2rem,5vw,5rem)] py-[clamp(3rem,6vw,5rem)] max-[820px]:grid-cols-1")} data-loading={loading || undefined}>
        <div className="border-t border-line-strong pt-[.7rem]"><p className={eyebrow}>Mission</p></div>
        <div>
          <h2 className={cn("m-0 max-w-[850px] font-serif text-[clamp(2rem,4vw,3.7rem)] leading-none font-medium tracking-[-.04em]", loadingPlaceholder(loading, "text"))} data-placeholder={loading ? "text" : undefined}>{content.missionTitle}</h2>
          <p className={cn("mt-[1.2rem] mb-0 ml-auto max-w-[680px] text-[.84rem] leading-[1.7] text-ink-muted max-[820px]:ml-0", loadingPlaceholder(loading, "text"))} data-placeholder={loading ? "text" : undefined}>{content.missionBody}</p>
        </div>
      </section>

      <section className="border-y border-line-strong bg-paper text-ink" data-loading={loading || undefined}>
        <div className={cn(shell, "py-[clamp(3rem,6vw,5rem)]")}>
          <header className="mb-[1.6rem] grid grid-cols-[minmax(150px,.28fr)_minmax(0,1fr)] items-end gap-8 max-[820px]:grid-cols-1">
            <div><p className={eyebrow}>Research focus</p></div>
            <h2 className={cn("m-0 font-serif text-[clamp(2rem,4vw,3.4rem)] leading-none font-medium tracking-[-.035em]", loadingPlaceholder(loading, "text"))} data-placeholder={loading ? "text" : undefined}>{content.focusTitle}</h2>
          </header>
          <ul className="m-0 grid list-none grid-cols-2 border-t border-line-strong p-0 max-[640px]:grid-cols-1">
            {content.focusAreas.map((area, index) => (
              <li className="grid min-h-16 items-center border-r border-b border-line px-[.9rem] py-[.7rem] odd:pl-0 even:border-r-0 max-[640px]:border-r-0 max-[640px]:pl-0" key={`${area}-${index}`}>
                <strong className={cn("font-serif text-base font-medium", loadingPlaceholder(loading, "text"))} data-placeholder={loading ? "text" : undefined}>{area}</strong>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={cn(shell, "grid grid-cols-[minmax(150px,.28fr)_minmax(0,1fr)] gap-[clamp(2rem,5vw,5rem)] py-[clamp(3rem,6vw,5rem)] max-[820px]:grid-cols-1")} data-loading={loading || undefined}>
        <div className="border-t border-line-strong pt-[.7rem]"><p className={eyebrow}>Organization</p></div>
        <div>
          <h2 className={cn("m-0 max-w-[850px] font-serif text-[clamp(2rem,4vw,3.7rem)] leading-none font-medium tracking-[-.04em]", loadingPlaceholder(loading, "text"))} data-placeholder={loading ? "text" : undefined}>{content.organizationTitle}</h2>
          <p className={cn("mt-[1.2rem] mb-0 ml-auto max-w-[680px] text-[.84rem] leading-[1.7] text-ink-muted max-[820px]:ml-0", loadingPlaceholder(loading, "text"))} data-placeholder={loading ? "text" : undefined}>{content.organizationBody}</p>
          <Link className="mt-[1.3rem] ml-auto flex max-w-[680px] items-center justify-between gap-2 border-b border-line pb-[.55rem] text-[.7rem] text-brand max-[820px]:ml-0" href="/people" prefetch={false}>Meet the research team <ArrowRight aria-hidden="true" size={16} /></Link>
        </div>
      </section>

      <section className="bg-dark-surface text-dark-ink">
        <div className={cn(shell, "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8 py-[clamp(3rem,6vw,4.5rem)] max-[820px]:grid-cols-1 max-[820px]:items-start")}>
          <div><p className="m-0 font-mono text-[.66rem] font-semibold tracking-[.105em] text-dark-accent uppercase">Connect</p><h2 className="mt-[.6rem] mb-[.8rem] font-serif text-[clamp(2rem,4vw,3.5rem)] leading-none font-medium">{content.closingTitle}</h2><p className="m-0 max-w-[680px] text-[.82rem] leading-[1.6] text-dark-copy">{content.closingBody}</p></div>
          <div className="flex flex-wrap gap-[.6rem] max-[640px]:grid"><ButtonLink href="/open-positions" variant="dark">View open positions <ArrowRight aria-hidden="true" size={18} /></ButtonLink><ButtonLink href="/projects" variant="dark-outline">Explore projects</ButtonLink></div>
        </div>
      </section>
    </div>
  );
}
