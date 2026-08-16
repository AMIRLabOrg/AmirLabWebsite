import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MotionScene } from "@/components/motion-scene";
import { PaperCard } from "@/components/paper-card";
import { ResearchCard } from "@/components/research-card";
import { ResearchStats } from "@/components/research-stats";
import { StatePanel } from "@/components/state-panel";
import { UniversitiesMarquee } from "@/components/universities-marquee";
import { ButtonLink } from "@/components/ui/button-control";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { DEFAULT_HOME_CONTENT } from "@/lib/site-content";
import type {
  HomeContent,
  Position,
  PublicStats,
  ResearchItem,
  University,
} from "@/lib/types";

const EMPTY_STATS: PublicStats = {
  papers: 0,
  people: 0,
  datasets: 0,
  projects: 0,
  openPositions: 0,
};
const shell =
  "mx-auto w-full max-w-[var(--public-wide)] px-[clamp(1rem,3.2vw,3rem)] max-[640px]:px-4";
const eyebrow =
  "font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase";

export function HomePageView({
  content = DEFAULT_HOME_CONTENT,
  research = [],
  positions = [],
  stats = EMPTY_STATS,
  universities = [],
  loading = false,
}: {
  content?: HomeContent;
  research?: ResearchItem[];
  positions?: Position[];
  stats?: PublicStats;
  universities?: University[];
  loading?: boolean;
}) {
  const researchRows: Array<ResearchItem | undefined> = loading
    ? Array.from({ length: 3 }, () => undefined)
    : research.slice(0, 3);
  return (
    <div>
      <section
        aria-busy={loading || undefined}
        className={cn(
          shell,
          "grid min-h-[390px] grid-cols-[minmax(0,1.25fr)_minmax(300px,.55fr)] items-stretch gap-[clamp(2rem,4vw,4.5rem)] border-b border-line-strong py-[clamp(2.6rem,5vw,4.3rem)] max-[900px]:min-h-0 max-[900px]:grid-cols-1 max-[640px]:gap-[1.7rem] max-[640px]:py-[2.6rem]",
        )}
        data-loading={loading || undefined}
      >
        <div className="grid content-center">
          <p className="mb-[.65rem] font-mono text-[.62rem] font-semibold tracking-[.105em] text-brand uppercase">
            {content.establishment}
          </p>
          <h1 className="m-0 max-w-[980px] font-serif text-[clamp(3.1rem,6vw,5.8rem)] leading-[.88] font-medium tracking-[-.065em] max-[640px]:text-[clamp(3rem,14vw,4.4rem)]">
            {content.heroTitle}
          </h1>
          <p
            className={cn(
              "mt-[1.35rem] mb-0 max-w-[720px] text-[.92rem] leading-[1.65] text-ink-muted",
              loading && loadingPlaceholder(true, "text"),
            )}
          >
            {content.heroIntroduction}
          </p>
          <div className="mt-[1.4rem] flex flex-wrap gap-3">
            <ButtonLink href="/papers" variant="primary">
              {content.primaryCtaLabel}{" "}
              <ArrowRight aria-hidden="true" size={18} />
            </ButtonLink>
            <ButtonLink href="/people" variant="secondary">
              {content.secondaryCtaLabel}
            </ButtonLink>
          </div>
        </div>
        <aside
          className="grid grid-rows-[170px_auto_1fr] border-l border-line pl-6 max-[900px]:grid-cols-[180px_minmax(0,1fr)] max-[900px]:grid-rows-[auto_auto] max-[900px]:border-t max-[900px]:border-l-0 max-[900px]:pt-4 max-[900px]:pl-0 max-[640px]:grid-cols-1"
          data-loading={loading || undefined}
        >
          <div className="overflow-hidden border-b border-line max-[900px]:row-span-2 max-[900px]:mr-4 max-[900px]:h-[150px] max-[640px]:hidden">
            <MotionScene className="h-[190px] w-full opacity-70" />
          </div>
          <header className="grid gap-[.15rem] border-b border-line-strong py-[.7rem] max-[900px]:self-start">
            <span className="font-mono text-[.54rem] tracking-[.08em] text-ink-faint uppercase">
              AMIR Lab
            </span>
            <strong className="font-serif text-[1.15rem] font-medium">
              Research at a glance
            </strong>
          </header>
          <dl className="m-0 max-[900px]:grid max-[900px]:grid-cols-2">
            {[
              ["People", stats.people],
              ["Papers", stats.papers],
              ["Datasets", stats.datasets],
              ["Projects", stats.projects],
            ].map(([label, value]) => (
              <div
                className="grid grid-cols-[1fr_auto] items-baseline border-b border-dotted border-line py-[.48rem] max-[900px]:pr-4"
                key={String(label)}
              >
                <dt className="font-mono text-[.54rem] tracking-[.08em] text-ink-faint uppercase">
                  {label}
                </dt>
                <dd
                  className={cn(
                    "m-0 font-serif text-xl",
                    loading && loadingPlaceholder(true, "value"),
                  )}
                  data-placeholder={loading ? "value" : undefined}
                >
                  {loading ? "00" : value}
                </dd>
              </div>
            ))}
          </dl>
        </aside>
      </section>

      <ResearchStats loading={loading} stats={stats} />

      {!loading && universities.length > 0 ? (
        <section className="pt-16">
          <div className={shell}>
            <p className="mb-4 text-left font-mono text-[.58rem] font-medium tracking-[.1em] text-ink-faint uppercase">
              Academic Partners
            </p>
            <UniversitiesMarquee universities={universities} />
          </div>
        </section>
      ) : null}

      <section
        className={cn(shell, "py-[clamp(3.25rem,6vw,5.5rem)]")}
        data-loading={loading || undefined}
      >
        <div className="mb-[1.4rem] flex items-end justify-between gap-5 border-t border-line-strong pt-[.85rem] max-[640px]:flex-col max-[640px]:items-start">
          <div>
            <p className={cn(eyebrow, "mb-[.65rem]")}>
              {content.latestEyebrow}
            </p>
            <h2 className="m-0 font-serif text-[clamp(1.9rem,3vw,3rem)] font-medium tracking-[-.035em]">
              {content.latestTitle}
            </h2>
          </div>
          <Link
            className="text-[.76rem] font-semibold text-brand underline decoration-[color-mix(in_srgb,var(--brand)_35%,transparent)] underline-offset-[3px]"
            href="/papers"
            prefetch={false}
          >
            View all{" "}
            <ArrowRight aria-hidden="true" className="inline" size={16} />
          </Link>
        </div>
        {researchRows.length ? (
          <div className="grid gap-0">
            {researchRows.map((item, index) =>
              !item || item.type === "PAPER" ? (
                <PaperCard
                  compact
                  item={item}
                  key={item?.id ?? `loading-paper-${index}`}
                  loading={loading}
                />
              ) : (
                <ResearchCard item={item} key={item.id} loading={false} />
              ),
            )}
          </div>
        ) : (
          <StatePanel
            body="Published work will appear here when available."
            title="No publications yet"
          />
        )}
      </section>

      <section className="bg-dark-surface text-dark-ink">
        <div
          className={cn(
            shell,
            "grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8 py-[3.8rem] max-[900px]:grid-cols-1",
          )}
        >
          <div>
            <p className="mb-[.65rem] font-mono text-[.66rem] font-semibold tracking-[.105em] text-dark-accent uppercase">
              {content.recruitmentEyebrow}
            </p>
            <h2 className="mt-2 mb-[.8rem] max-w-[720px] font-serif text-[clamp(2rem,4vw,3.4rem)] leading-none font-medium tracking-[-.035em] text-dark-ink">
              {content.recruitmentTitle}
            </h2>
            <p className="m-0 max-w-[650px] text-[.8rem] leading-[1.6] text-dark-muted">
              {content.recruitmentBody}
            </p>
          </div>
          <ButtonLink
            className="m-0 max-[900px]:justify-self-start"
            href="/open-positions"
            variant="dark"
          >
            {loading
              ? "Explore opportunities"
              : positions.length
                ? `View ${positions.length} open ${positions.length === 1 ? "role" : "roles"}`
                : "Explore opportunities"}
            <ArrowRight aria-hidden="true" size={18} />
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
