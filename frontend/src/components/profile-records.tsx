"use client";

import { ChevronDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { InputControl } from "@/components/ui/form-controls";
import { PublicShell } from "@/components/ui/public-shell";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import type { ProfileContentBlock, ProfileRecordView } from "@/lib/profile-content";

const ENTRY_PREVIEW_LIMIT = 6;
const LOADING_RECORDS: ProfileRecordView[] = [
  { id: "loading-education", title: "Education & appointments", type: "profile records", entryCount: 3, blocks: [{ heading: null, entries: ["Academic record", "Research appointment", "Institutional affiliation"] }] },
  { id: "loading-activity", title: "Research activity", type: "research records", entryCount: 3, blocks: [{ heading: null, entries: ["Research activity", "Professional record", "Scientific contribution"] }] },
];

export function ProfileRecords({ records = [], loading = false }: { records?: ProfileRecordView[]; loading?: boolean }) {
  const visible = loading ? LOADING_RECORDS : records;
  return (
    <div aria-busy={loading || undefined} data-loading={loading || undefined}>
      <PublicShell as="nav" aria-label="Profile sections" className="sticky top-[62px] z-20 flex overflow-x-auto border-b border-line bg-[color-mix(in_srgb,var(--canvas)_94%,transparent)] px-0 [scrollbar-width:none] max-[640px]:px-0">
        {visible.map((record, index) => (
          <a aria-disabled={loading || undefined} className="grid min-h-[66px] flex-[1_0_190px] grid-cols-[26px_1fr_auto] items-center gap-[.2rem] border-r border-line px-4 py-[.8rem] hover:bg-brand-faint/60" href={loading ? undefined : `#profile-section-${record.id}`} key={record.id} tabIndex={loading ? -1 : undefined}>
            <span className="font-mono text-[.62rem] text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
            <strong className={cn("font-serif text-[.9rem] font-medium", loading && loadingPlaceholder(true, "text"))} data-placeholder={loading ? "text" : undefined}>{record.title}</strong>
            <small className={cn("font-mono text-[.62rem] text-ink-muted", loading && loadingPlaceholder(true, "value"))} data-placeholder={loading ? "value" : undefined}>{loading ? "00" : record.entryCount}</small>
          </a>
        ))}
      </PublicShell>
      <PublicShell as="main" className="grid pb-32">
        {visible.map((record, sectionIndex) => <ProfileRecord index={sectionIndex} key={record.id} loading={loading} record={record} />)}
      </PublicShell>
    </div>
  );
}

function ProfileRecord({ index, record, loading = false }: { index: number; record: ProfileRecordView; loading?: boolean }) {
  const [query, setQuery] = useState("");
  const searchable = !loading && record.entryCount > 12;
  const normalizedQuery = query.trim().toLowerCase();
  const blocks = useMemo(() => normalizedQuery
    ? record.blocks.flatMap((block) => {
        const entries = block.entries.filter((entry) => entry.toLowerCase().includes(normalizedQuery));
        return entries.length ? [{ ...block, entries }] : [];
      })
    : record.blocks,
  [normalizedQuery, record.blocks]);

  return (
    <section className="grid scroll-mt-[130px] grid-cols-[minmax(230px,.38fr)_minmax(0,1fr)] gap-[clamp(2rem,6vw,6rem)] border-b border-line py-16 max-[960px]:grid-cols-1 max-[960px]:gap-8 max-[640px]:py-14" id={loading ? undefined : `profile-section-${record.id}`}>
      <header className="sticky top-[150px] grid grid-cols-[32px_1fr] items-start gap-4 self-start max-[960px]:static max-[640px]:grid-cols-[24px_1fr]">
        <span className="font-mono text-[.68rem] text-ink-muted">{String(index + 1).padStart(2, "0")}</span>
        <div>
          <p className="mb-[.6rem] font-mono text-[.68rem] tracking-[.07em] text-brand uppercase">{record.type}</p>
          <h2 className={cn("m-0 font-serif text-[clamp(1.8rem,3vw,2.6rem)] font-normal", loading && loadingPlaceholder(true, "text"))} data-placeholder={loading ? "text" : undefined}>{record.title}</h2>
          <small className={cn("mt-[.7rem] block font-mono text-[.64rem] text-ink-muted", loading && loadingPlaceholder(true, "text"))} data-placeholder={loading ? "text" : undefined}>{loading ? "00 records" : `${record.entryCount} ${record.entryCount === 1 ? "record" : "records"}`}</small>
        </div>
      </header>
      <div className="grid min-w-0 gap-8">
        {searchable ? (
          <label className="grid grid-cols-[18px_minmax(0,1fr)] items-center gap-2 border-b border-line pb-3 text-ink-muted">
            <Search aria-hidden="true" size={17} /><span className="sr-only">Search {record.title}</span>
            <InputControl className="border-0 bg-transparent p-0 shadow-none! focus-visible:border-0 focus-visible:shadow-none!" onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${record.title.toLowerCase()}`} type="search" value={query} />
          </label>
        ) : null}
        <div className="grid min-w-0 gap-12">
          {blocks.length ? (
            (() => {
              let entryOffset = 0;
              return blocks.map((block, blockIndex) => {
                const blockEntryOffset = entryOffset;
                entryOffset += block.entries.length;
                return <ProfileBlock block={block} blockKey={`${record.id}-${blockIndex}`} entryOffset={blockEntryOffset} key={`${record.id}-${blockIndex}`} loading={loading} searching={Boolean(normalizedQuery)} />;
              });
            })()
          ) : <p className="m-0 py-8 text-ink-muted">No records match “{query}”.</p>}
        </div>
      </div>
    </section>
  );
}

function ProfileBlock({ block, blockKey, entryOffset, searching, loading = false }: { block: ProfileContentBlock; blockKey: string; entryOffset: number; searching: boolean; loading?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const hasMore = !loading && !searching && block.entries.length > ENTRY_PREVIEW_LIMIT;
  const entries = hasMore && !expanded ? block.entries.slice(0, ENTRY_PREVIEW_LIMIT) : block.entries;

  return (
    <section>
      {block.heading ? <header className="flex items-baseline justify-between"><h3 className={cn("mt-0 mb-5 font-serif text-[1.45rem] font-medium", loading && loadingPlaceholder(true, "text"))} data-placeholder={loading ? "text" : undefined}>{block.heading}</h3><span className="font-mono text-[.65rem] text-ink-muted">{block.entries.length}</span></header> : null}
      <div className="border-t border-line">
        {entries.map((entry, entryIndex) => (
          <article className="grid grid-cols-[32px_1fr] gap-4 border-b border-line py-[1.15rem]" key={`${blockKey}-${entryIndex}`}>
            <span className="font-mono text-[.68rem] text-ink-muted">{String(entryOffset + entryIndex + 1).padStart(2, "0")}</span>
            <div className="grid min-w-0 gap-[.35rem]">
              {entry.split("\n").map((line, lineIndex) => (
                <p className={cn("m-0 whitespace-pre-wrap break-words text-[.82rem] leading-[1.62] text-ink-muted", lineIndex === 0 && "text-[.94rem] text-ink", loading && loadingPlaceholder(true, "text"))} data-placeholder={loading ? "text" : undefined} key={lineIndex}>{line}</p>
              ))}
            </div>
          </article>
        ))}
      </div>
      {hasMore ? (
        <button aria-expanded={expanded} className="mt-[.9rem] inline-flex cursor-pointer items-center gap-[.4rem] border-0 bg-transparent p-0 text-[.75rem] font-bold text-brand hover:text-brand-hover" onClick={() => setExpanded((value) => !value)} type="button">
          {expanded ? "Show fewer" : `Show all ${block.entries.length}`}<ChevronDown aria-hidden="true" size={15} />
        </button>
      ) : null}
    </section>
  );
}
