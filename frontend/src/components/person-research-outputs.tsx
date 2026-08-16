"use client";

import { useState } from "react";
import { PaperCard } from "@/components/paper-card";
import { ResearchCard } from "@/components/research-card";
import { Eyebrow, PublicShell } from "@/components/ui/public-shell";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import type { Person, ResearchItem, ResearchItemType } from "@/lib/types";

const LABELS: Record<ResearchItemType, string> = { PAPER: "Papers", DATASET: "Datasets", PROJECT: "Projects" };
const PREVIEW_SIZE = 6;

export function PersonResearchOutputs({ contributions = [], loading = false }: { contributions?: NonNullable<Person["contributions"]>; loading?: boolean }) {
  const [expanded, setExpanded] = useState<Partial<Record<ResearchItemType, boolean>>>({});
  const groups = loading
    ? (["PAPER", "PROJECT"] as const).map((type) => ({ items: Array.from({ length: 3 }, () => undefined as ResearchItem | undefined), type }))
    : (["PAPER", "DATASET", "PROJECT"] as const)
        .map((type) => ({ items: contributions.map(({ researchItem }) => researchItem).filter((item) => item.type === type), type }))
        .filter(({ items }) => items.length);

  if (!groups.length) return null;
  return (
    <section aria-busy={loading || undefined} aria-labelledby="verified-research-title" className="border-b border-line bg-surface py-[clamp(3.5rem,7vw,6rem)]" data-loading={loading || undefined}>
      <PublicShell className="grid gap-12">
        <div className="max-w-[620px]">
          <Eyebrow>Research</Eyebrow>
          <h2 className="my-[.65rem] mb-4 font-serif text-[clamp(2.3rem,5vw,4.2rem)] leading-[.95]" id="verified-research-title">Research outputs</h2>
          <p className="m-0 leading-[1.65] text-ink-muted">Papers, datasets, and projects linked to this profile.</p>
        </div>
        {groups.map(({ items, type }) => {
          const visible = loading ? items : expanded[type] ? items : items.slice(0, PREVIEW_SIZE);
          return (
            <section className="grid gap-5" key={type}>
              <div className="flex items-center justify-between border-b border-line pb-[.7rem]">
                <h3 className="m-0 font-serif text-2xl">{LABELS[type]}</h3>
                <span className={cn("font-mono text-[.75rem] text-brand", loading && loadingPlaceholder(true, "value"))} data-placeholder={loading ? "value" : undefined}>{loading ? "00" : items.length}</span>
              </div>
              <div className={type === "PAPER" ? "grid" : "grid grid-cols-3 gap-px border border-line bg-line max-[980px]:grid-cols-2 max-[640px]:grid-cols-1"}>
                {visible.map((item, index) => type === "PAPER"
                  ? <PaperCard item={item} key={item?.id ?? `loading-paper-${index}`} loading={loading} />
                  : <ResearchCard item={item} key={item?.id ?? `loading-record-${index}`} loading={loading} />)}
              </div>
              {!loading && items.length > PREVIEW_SIZE ? (
                <button className="mt-[.9rem] inline-flex w-fit cursor-pointer items-center border-0 bg-transparent p-0 text-[.75rem] font-bold text-brand hover:text-brand-hover" onClick={() => setExpanded((current) => ({ ...current, [type]: !current[type] }))} type="button">
                  {expanded[type] ? "Show fewer" : `See all ${items.length}`}
                </button>
              ) : null}
            </section>
          );
        })}
      </PublicShell>
    </section>
  );
}
