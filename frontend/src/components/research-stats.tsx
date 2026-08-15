import { AnimatedCounter } from "./animated-counter";
import type { PublicStats } from "@/lib/types";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function ResearchStats({ stats, loading = false }: { stats?: PublicStats; loading?: boolean }) {
  const value = stats ?? { papers: 0, people: 0, datasets: 0, projects: 0, openPositions: 0 };
  const required = [[value.papers, "Verified papers"], [value.people, "Lab community"]] as const;
  const optional = [[value.datasets + value.projects, "Datasets and projects"], [value.openPositions, "Open positions"]] as const;
  const values = loading ? [...required, ...optional] : [...required, ...optional.filter(([count]) => count > 0)];

  return (
    <section aria-busy={loading || undefined} aria-label="AmirLab in numbers" className="mx-auto grid w-full max-w-[var(--public-wide)] grid-cols-4 border-b border-line-strong px-[clamp(1rem,3.2vw,3rem)] max-[640px]:grid-cols-2 max-[640px]:px-4" data-loading={loading || undefined}>
      {values.map(([count, label]) => (
        <article className="grid gap-[.3rem] border-r border-line px-[1.3rem] py-4 first:pl-0 last:border-r-0 max-[640px]:border-b max-[640px]:p-4 max-[640px]:first:pl-4 max-[640px]:even:border-r-0" key={label}>
          <strong className={cn("font-serif text-[2rem] leading-none font-medium text-ink", loading && loadingPlaceholder(true, "value"))} data-placeholder={loading ? "value" : undefined}>{loading ? "000" : <AnimatedCounter value={count} />}</strong>
          <span className="font-mono text-[.58rem] text-ink-muted uppercase">{label}</span>
        </article>
      ))}
    </section>
  );
}
