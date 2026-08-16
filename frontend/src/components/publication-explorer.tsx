"use client";

import * as Popover from "@radix-ui/react-popover";
import { Filter, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PaginationControls } from "@/components/pagination-controls";
import { MotionScene } from "@/components/motion-scene";
import { PaperCard } from "@/components/paper-card";
import { StatePanel } from "@/components/state-panel";
import { Badge } from "@/components/ui/badge";
import { SelectControl } from "@/components/ui/select-control";
import { FormField } from "@/components/ui/form-field";
import { TabsControl } from "@/components/ui/tabs-control";
import { ToolbarSearchField } from "@/components/ui/toolbar-search-field";
import { ButtonControl } from "@/components/ui/button-control";
import { apiRequest } from "@/lib/client-api";
import type { PaginatedResponse, ResearchItem } from "@/lib/types";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

interface PublicationResponse extends PaginatedResponse<ResearchItem> {
  facets: {
    categories: Array<{ count: number; label: string; value: string }>;
    years: Array<{ count: number; value: number }>;
  };
}

const SORT_OPTIONS = [
  { label: "Newest first", value: "NEWEST" },
  { label: "Oldest first", value: "OLDEST" },
  { label: "Title A–Z", value: "TITLE" },
];

export function PublicationExplorer({ staticLoading = false }: { staticLoading?: boolean } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") ?? "");
  const [category, setCategory] = useState(searchParams.get("category") ?? "ALL");
  const [year, setYear] = useState(searchParams.get("year") ?? "ALL");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "NEWEST");
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [result, setResult] = useState<PublicationResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const busy = staticLoading || loading;

  useEffect(() => {
    if (staticLoading) return;
    let active = true;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(page), pageSize: "12", sort });
      if (query.trim()) params.set("search", query.trim());
      if (category !== "ALL") params.set("category", category);
      if (year !== "ALL") params.set("year", year);
      router.replace(`/papers?${params}`, { scroll: false });
      void apiRequest<PublicationResponse>(`/publications?${params}`, { method: "GET" })
        .then((response) => {
          if (!active) return;
          setResult(response);
          setError(undefined);
        })
        .catch((caught: unknown) => {
          if (active) setError(caught instanceof Error ? caught.message : "Unable to load publications.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [category, page, query, router, sort, staticLoading, year]);

  function changeFilter(setter: (value: string) => void, value: string) {
    setLoading(true);
    setter(value);
    setPage(1);
  }

  function clearFilters() {
    setLoading(true);
    setQuery("");
    setCategory("ALL");
    setYear("ALL");
    setSort("NEWEST");
    setPage(1);
  }

  const categories = [
    { count: result?.facets.categories.reduce((sum, item) => sum + item.count, 0), label: "All", value: "ALL" },
    ...(result?.facets.categories ?? []),
  ];
  const yearOptions = [
    { label: "All years", value: "ALL" },
    ...(result?.facets.years.map((item) => ({ label: `${item.value} · ${item.count}`, value: String(item.value) })) ?? []),
  ];
  const activeFilters = Boolean(query || category !== "ALL" || year !== "ALL" || sort !== "NEWEST");
  const visibleRows: Array<ResearchItem | undefined> = busy
    ? result?.items.length
      ? result.items
      : Array.from({ length: 6 }, () => undefined)
    : result?.items ?? [];

  return (
      <section
        aria-busy={busy || undefined}
        aria-label="Publication archive"
        className="mx-auto grid w-full max-w-[var(--public-wide)] gap-4 px-[clamp(1rem,3.2vw,3rem)] pt-6 pb-20 max-[640px]:px-4"
      >
        <div className="grid grid-cols-[minmax(240px,1.55fr)_minmax(300px,.85fr)] items-end gap-[.65rem] border-b border-line-strong pb-[.85rem] max-[640px]:grid-cols-[minmax(0,1fr)_auto]">
          <ToolbarSearchField
            id="publication-search"
            label=""
            onChange={(event) => {
              setLoading(true);
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search title, author, venue, or DOI"
            value={query}
          />
          <div className="grid grid-cols-2 gap-2 max-[640px]:hidden">
            <SelectControl ariaLabel="Publication year" onValueChange={(value) => changeFilter(setYear, value)} options={yearOptions} value={year} />
            <SelectControl ariaLabel="Sort publications" onValueChange={(value) => changeFilter(setSort, value)} options={SORT_OPTIONS} value={sort} />
          </div>
          <Popover.Root>
            <Popover.Trigger className="hidden min-h-[var(--control-height)] cursor-pointer items-center gap-[.35rem] rounded-control border border-line-strong bg-transparent px-[.7rem] py-[.55rem] text-[.72rem] text-ink max-[640px]:inline-flex"><Filter aria-hidden="true" size={16} /> Filters</Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" className="z-[90] grid w-[min(300px,calc(100vw-2rem))] gap-[.8rem] rounded-dialog border border-line-strong bg-surface-raised p-4 shadow-[var(--shadow-float)]" sideOffset={8}>
                <FormField label="Year" labelClassName="text-[.78rem] font-[650] tracking-[.04em]"><SelectControl ariaLabel="Publication year" onValueChange={(value) => changeFilter(setYear, value)} options={yearOptions} value={year} /></FormField>
                <FormField label="Sort" labelClassName="text-[.78rem] font-[650] tracking-[.04em]"><SelectControl ariaLabel="Sort publications" onValueChange={(value) => changeFilter(setSort, value)} options={SORT_OPTIONS} value={sort} /></FormField>
                <Popover.Arrow className="fill-surface-raised" />
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>

        <div className="flex items-end justify-between gap-4 overflow-hidden border-b border-line-strong max-[640px]:flex-col max-[640px]:items-stretch max-[640px]:gap-0">
          <TabsControl ariaLabel="Publication categories" className="min-w-0 overflow-x-auto max-[640px]:order-2 max-[640px]:w-full" onValueChange={(value) => changeFilter(setCategory, value)} options={categories} value={category} />
          <div className="flex min-h-10 shrink-0 items-center gap-[.65rem] font-mono text-[.58rem] text-ink-muted max-[640px]:order-1 max-[640px]:justify-between" data-loading={busy || undefined}>
            <Badge loading={busy}>{busy ? "00 results" : `${result?.total ?? 0} results`}</Badge>
            {activeFilters ? <ButtonControl className="font-[inherit]" compact onClick={clearFilters} variant="ghost">Clear <X aria-hidden="true" size={13} /></ButtonControl> : null}
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_minmax(250px,300px)] items-start gap-[clamp(1.5rem,3vw,3rem)] max-[900px]:grid-cols-1">
          <div className="min-w-0">
            {error && !result && !busy ? (
              <StatePanel body={error} title="Publications could not be loaded" variant="error" />
            ) : visibleRows.length ? (
              <div className="grid transition-opacity duration-[140ms]">
                {visibleRows.map((item, index) => (
                  <PaperCard item={item} key={item?.id ?? `loading-paper-${index}`} loading={busy} />
                ))}
              </div>
            ) : (
              <StatePanel body="Try a broader title, author, year, or publication category." title="No publications match these filters" />
            )}
            {busy || result ? (
              <PaginationControls
                loading={busy}
                onPageChange={(next) => {
                  setLoading(true);
                  setPage(next);
                  window.scrollTo({ behavior: "smooth", top: 180 });
                }}
                page={result?.page ?? 1}
                pageSize={result?.pageSize ?? 12}
                total={result?.total ?? 0}
                totalPages={result?.totalPages ?? 1}
              />
            ) : null}
          </div>

          <aside className="sticky top-[82px] grid gap-4 border-t border-line-strong max-[900px]:static max-[900px]:grid-cols-[minmax(180px,.65fr)_minmax(0,1fr)] max-[900px]:pt-4 max-[640px]:grid-cols-1" data-loading={busy || undefined}>
            <div className="h-[150px] overflow-hidden border-b border-line max-[900px]:h-[130px] max-[900px]:border-b-0 max-[640px]:hidden"><MotionScene className="h-[170px] w-full opacity-70" variant="paper" /></div>
            <section>
              <p className="mb-[.65rem] font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase">Publication search</p>
              <h2 className="m-0 font-serif text-[1.55rem] font-medium tracking-[-.03em]">Find papers by topic, author, or year.</h2>
              <p className="mt-[.55rem] mb-0 text-[.72rem] leading-[1.62] text-ink-muted">Filter the publication list by category and year. DOI and source links are shown when they are available.</p>
            </section>
            <dl className="m-0 border-t border-line-strong max-[900px]:col-span-full max-[900px]:grid max-[900px]:grid-cols-3 max-[640px]:col-auto">
              {[
                ["Categories", busy ? "00" : result?.facets.categories.length ?? 0],
                ["Years", busy ? "00" : result?.facets.years.length ?? 0],
                ["On this page", busy ? "00" : result?.items.length ?? 0],
              ].map(([label, value]) => (
                <div className="grid grid-cols-[1fr_auto] items-baseline border-b border-dotted border-line py-[.55rem] max-[900px]:pr-4" key={String(label)}>
                  <dt className="font-mono text-[.55rem] text-ink-faint uppercase">{label}</dt>
                  <dd className={cn("m-0 font-serif text-base", busy && loadingPlaceholder(true, "value"))} data-placeholder={busy ? "value" : undefined}>{value}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </section>
  );
}
