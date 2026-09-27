import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PaperCard } from "@/components/paper-card";
import { ResearchCard } from "@/components/research-card";
import { ResearchStats } from "@/components/research-stats";
import { StatePanel } from "@/components/state-panel";
import { UniversitiesMarquee } from "@/components/universities-marquee";
import { ButtonLink } from "@/components/ui/button-control";
import {
  FrameNodes,
  FrameRails,
  FrameRule,
  FrameRuleNodes,
} from "@/components/ui/public-shell";
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
  "mx-auto w-full max-w-[var(--public-wide)] px-[var(--public-gutter)]";
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
        className={cn("relative border-b border-line-strong lg:border-b-0")}
        data-loading={loading || undefined}
      >
        <FrameNodes className="z-[3] lg:hidden" edge="bottom" />
        <FrameRule edge="bottom" />
        <div
          className={cn(
            shell,
            "grid min-h-[390px] content-center py-[clamp(3rem,6vw,5rem)] max-[900px]:min-h-0 max-[640px]:py-[2.6rem]",
          )}
        >
          <div className="relative z-[2] grid content-center">
            <p className="mb-[.65rem] font-mono text-[.62rem] font-semibold tracking-[.105em] text-brand uppercase">
              {content.establishment}
            </p>
            <h1 className="m-0 max-w-[980px] font-sans text-[clamp(2.7rem,5.2vw,4.125rem)] leading-[1] font-medium tracking-[-.05em] max-[640px]:text-[clamp(2.5rem,12vw,3.25rem)]">
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
        </div>
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
        <div className="mb-[1.4rem] flex items-end justify-between gap-5 max-[640px]:flex-col max-[640px]:items-start">
          <div>
            <p className={cn(eyebrow, "mb-[.65rem]")}>
              {content.latestEyebrow}
            </p>
            <h2 className="m-0 font-sans text-[clamp(1.9rem,3vw,3rem)] font-medium tracking-[-.035em]">
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
                  frame
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

      <section className="relative isolate border-t border-line-strong bg-surface">
        <FrameRails />
        <div className="pointer-events-none absolute inset-y-0 left-1/2 z-[1] hidden w-full max-w-[var(--public-wide)] -translate-x-1/2 lg:block">
          <svg
            aria-hidden="true"
            className="absolute inset-y-0 right-0 h-full w-[min(26%,300px)]"
            preserveAspectRatio="none"
            viewBox="0 0 360 240"
            width="360"
            height="240"
          >
            <defs>
              <pattern
                height="18"
                id="recruitment-diagonal-pattern"
                patternTransform="rotate(45)"
                patternUnits="userSpaceOnUse"
                width="18"
              >
                <rect
                  fill="var(--line-strong)"
                  fillOpacity=".65"
                  height="18"
                  width="2"
                />
              </pattern>
            </defs>
            <rect
              fill="url(#recruitment-diagonal-pattern)"
              height="100%"
              width="100%"
            />
          </svg>
          <div className="absolute inset-y-0 right-0 w-[min(31%,360px)] bg-gradient-to-r from-surface via-surface/65 to-transparent" />
        </div>
        <FrameRuleNodes
          className="top-0 z-10"
          nodeSurfaceClassName="bg-surface"
        />
        <div
          className={cn(
            shell,
            "relative z-[2] grid grid-cols-[minmax(0,1fr)_auto] items-end gap-8 py-[3.8rem] max-[900px]:grid-cols-1",
          )}
        >
          <div className="relative z-[2]">
            <p className="mb-[.65rem] font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase">
              {content.recruitmentEyebrow}
            </p>
            <h2 className="mt-2 mb-[.8rem] max-w-[720px] font-sans text-[clamp(2rem,4vw,3rem)] leading-[1.05] font-medium tracking-[-.035em] text-ink">
              {content.recruitmentTitle}
            </h2>
            <p className="m-0 max-w-[650px] text-[.8rem] leading-[1.6] text-ink-muted">
              {content.recruitmentBody}
            </p>
          </div>
          <ButtonLink
            className="m-0 max-[900px]:justify-self-start"
            href="/open-positions"
            variant="primary"
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
