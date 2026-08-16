import { getResearch } from "@/lib/api";
import type { ResearchItem, ResearchItemType } from "@/lib/types";
import { IntroRegister, PageIntro } from "./page-intro";
import { PaperCard } from "./paper-card";
import { ResearchCard } from "./research-card";
import { StatePanel } from "./state-panel";
import { MotionScene } from "./motion-scene";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

type ResearchListingProps = { type: ResearchItemType; eyebrow: string; title: string; description: string; };

export async function ResearchListing(props: ResearchListingProps) {
  const items = await getResearch(props.type);
  return <ResearchListingView {...props} items={items} />;
}

export function ResearchListingView({ type, eyebrow, title, description, items, loading = false }: ResearchListingProps & { items?: ResearchItem[]; loading?: boolean }) {
  const list = items ?? [];
  const isDataset = type === "DATASET";
  const visibleItems: Array<ResearchItem | undefined> = loading ? Array.from({ length: 6 }, () => undefined) : list;

  return (
    <>
      <PageIntro
        aside={<IntroRegister loading={loading} items={[{ label: "Published", value: loading ? "00" : list.length }, { label: "Type", value: isDataset ? "Dataset" : "Project" }, { label: "Related", value: isDataset ? "Projects / papers" : "People / outputs" }, { label: "Access", value: "Public" }]} title={`${title} overview`} />}
        eyebrow={eyebrow}
        meta={<><span>Public entries</span><span>Source links where available</span></>}
        title={title}
      >{description}</PageIntro>

      <section aria-busy={loading || undefined} className="mx-auto grid w-full max-w-[var(--public-wide)] grid-cols-[minmax(0,1fr)_minmax(250px,300px)] items-start gap-[clamp(1.5rem,3vw,3rem)] px-[clamp(1rem,3.2vw,3rem)] pt-8 pb-20 max-[900px]:grid-cols-1 max-[640px]:px-4 max-[640px]:pt-[1.4rem] max-[640px]:pb-16" data-loading={loading || undefined} aria-label={title}>
        <div className="min-w-0">
          <header className="flex items-end justify-between border-y border-line-strong py-[.7rem]">
            <div><span className="font-mono text-[.55rem] tracking-[.08em] text-ink-faint">{isDataset ? "DATASETS" : "PROJECTS"}</span><h2 className="mt-[.15rem] mb-0 font-serif text-[1.55rem] font-medium tracking-[-.03em]">{isDataset ? "Available research resources" : "Current and completed work"}</h2></div>
            <strong className={cn("font-serif text-[2rem] font-medium", loading && loadingPlaceholder(true, "value"))} data-placeholder={loading ? "value" : undefined}>{loading ? "00" : list.length.toString()}</strong>
          </header>
          {visibleItems.length ? (
            <div className="grid">
              {visibleItems.map((item, index) => type === "PAPER" ? <PaperCard item={item} key={item?.id ?? `loading-${index}`} loading={loading} /> : <ResearchCard item={item} key={item?.id ?? `loading-${index}`} loading={loading} variant="index" />)}
            </div>
          ) : <StatePanel body={`Published ${title.toLowerCase()} will appear here when available.`} title={`No ${title.toLowerCase()} published yet`} />}
        </div>
        <aside className="sticky top-[82px] grid gap-[.6rem] border-t border-line-strong max-[900px]:static max-[900px]:grid-cols-[180px_minmax(0,1fr)] max-[900px]:pt-4 max-[640px]:grid-cols-1">
          <div className="h-[180px] overflow-hidden border-b border-line max-[900px]:row-span-3 max-[900px]:h-[150px] max-[640px]:hidden"><MotionScene className="h-[200px] w-full opacity-70" variant={isDataset ? "dataset" : "project"} /></div>
          <p className="m-0 font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase max-[900px]:col-start-2 max-[640px]:col-start-1">{isDataset ? "Dataset details" : "Project details"}</p>
          <h2 className="m-0 font-serif text-[1.55rem] font-medium tracking-[-.03em] max-[900px]:col-start-2 max-[640px]:col-start-1">{isDataset ? "Version, license, and access information." : "Objectives, milestones, team members, and outputs."}</h2>
          <p className="m-0 text-[.72rem] leading-[1.65] text-ink-muted max-[900px]:col-start-2 max-[640px]:col-start-1">{isDataset ? "Each dataset page shows the information supplied for access and reuse, together with related research when available." : "Each project page brings its public description, progress, collaborators, updates, and linked research together."}</p>
        </aside>
      </section>
    </>
  );
}
