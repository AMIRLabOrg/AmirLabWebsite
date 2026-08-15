"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import type { ResearchItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function PaperCard({ compact = false, item, loading = false }: { compact?: boolean; item?: ResearchItem; loading?: boolean }) {
  const [open, setOpen] = useState(false);
  const source = item?.canonicalUrl ?? item?.legacyUrl;
  const title = item?.title ?? item?.paper?.citation ?? (loading ? "Publication title is loading" : "Untitled paper");
  const linkedAuthors = (item?.contributors ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder).map(({ displayName }) => displayName).join(", ");
  const authors = linkedAuthors || authorsFromCitation(item?.paper?.citation, title) || (loading ? "Authors and affiliations" : "");
  const details = item?.summary ?? item?.paper?.citation;
  const category = item?.paper?.publicationType?.toLowerCase().replaceAll("_", " ");
  const doi = normalizeDoi(item?.paper?.doi);

  return (
    <article aria-busy={loading || undefined} className={cn("border-b border-line bg-transparent", compact && "")} data-loading={loading || undefined}>
      <button
        aria-expanded={!loading && open}
        className="block w-full cursor-pointer border-0 bg-transparent px-1 py-4 text-left text-inherit hover:bg-[color-mix(in_srgb,var(--brand-faint)_60%,transparent)] disabled:cursor-progress"
        disabled={loading}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="grid gap-[.36rem]">
          <span className="flex flex-wrap items-center gap-[7px]">
            <Badge loading={loading}>{item?.paper?.year ?? (loading ? "0000" : "Undated")}</Badge>
            {loading || category ? <Badge loading={loading}>{category ?? "publication"}</Badge> : null}
            {!loading && item?.paper?.venue ? <Badge>{item.paper.venue}</Badge> : null}
          </span>
          <strong className={cn("font-serif text-[1.06rem] leading-[1.34] font-medium transition-colors duration-[140ms] group-hover:text-brand", loading && loadingPlaceholder(true, "text", "long"))} data-placeholder={loading ? "text" : undefined} data-placeholder-width="long">{title}</strong>
          {loading || authors ? <span className={cn("text-[.72rem] leading-[1.5] text-ink-muted", loading && loadingPlaceholder(true, "text", "medium"))} data-placeholder={loading ? "text" : undefined} data-placeholder-width="medium">{authors}</span> : null}
          <em className={cn("text-[.63rem] font-normal text-ink-faint not-italic", loading && loadingPlaceholder(true, "text", "short"))} data-placeholder={loading ? "text" : undefined} data-placeholder-width="short">{loading ? "Publication record" : details ? (open ? "Click to collapse abstract" : "Click to expand abstract") : "Publication record"}</em>
        </span>
      </button>
      {!loading && open && details ? <div className="px-1 pb-[.8rem]"><p className="m-0 max-w-[850px] text-[.76rem] leading-[1.65] text-ink-muted">{details}</p></div> : null}
      <footer className="mt-[.6rem] flex items-center justify-between gap-4 border-t border-dotted border-line px-1 pt-[.62rem] pb-[.8rem] max-[640px]:flex-col max-[640px]:items-start">
        <span className={cn("font-mono text-[.55rem] text-ink-muted [overflow-wrap:anywhere]", loading && loadingPlaceholder(true, "text", "medium"))} data-placeholder={loading ? "text" : undefined} data-placeholder-width="medium">{loading ? "doi.org/00.0000/example" : doi ? `doi.org/${doi}` : "DOI not available"}</span>
        {loading || source ? <a aria-disabled={loading || undefined} className="inline-flex items-center gap-[.3rem] text-[.66rem] font-semibold text-brand" href={loading ? undefined : source ?? undefined} rel="noreferrer" tabIndex={loading ? -1 : undefined} target="_blank">Read paper <ArrowUpRight aria-hidden="true" className={loading ? "opacity-10" : undefined} size={14} /></a> : null}
      </footer>
    </article>
  );
}

function normalizeDoi(doi: string | null | undefined): string | null {
  const value = doi?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return value || null;
}

function authorsFromCitation(citation: string | null | undefined, title: string): string {
  if (!citation) return "";
  const cleanTitle = title.replace(/[.,;:]$/, "");
  const index = citation.toLocaleLowerCase().indexOf(cleanTitle.toLocaleLowerCase());
  if (index <= 0) return "";
  return citation.slice(0, index).replace(/^\s*\d+[.)]\s*/, "").replace(/\s*\(?\d{4}\)?\s*$/, "").replace(/[\s,:;“”"'‘’–—-]+$/, "").trim();
}
