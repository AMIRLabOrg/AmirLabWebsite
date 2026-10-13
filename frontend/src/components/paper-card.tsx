import { ArrowUpRight } from "lucide-react";
import type { ResearchItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { FramedRow } from "@/components/ui/public-shell";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function PaperCard({
  frame = false,
  item,
  loading = false,
}: {
  frame?: boolean;
  item?: ResearchItem;
  loading?: boolean;
}) {
  const dataset = item?.type === "DATASET";
  const source = item?.canonicalUrl ?? item?.legacyUrl ?? undefined;
  const title =
    item?.title ??
    item?.paper?.citation ??
    (loading
      ? "Publication title is loading"
      : dataset
        ? "Untitled dataset"
        : "Untitled paper");
  const linkedAuthors = (item?.contributors ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ displayName }) => displayName)
    .join(", ");
  const authors =
    linkedAuthors ||
    authorsFromCitation(item?.paper?.citation, title) ||
    (loading ? "Authors and affiliations" : "");
  const category = dataset
    ? "dataset"
    : item?.paper?.publicationType?.toLowerCase().replaceAll("_", " ");
  const doi = normalizeDoi(
    item?.paper?.doi ??
      source?.match(/^https?:\/\/(?:dx\.)?doi\.org\/(.+)$/i)?.[1],
  );
  const clickable = !loading && Boolean(source);
  const Row = clickable ? "a" : "div";
  return (
    <FramedRow
      as="article"
      aria-busy={loading || undefined}
      bleed={frame}
      className={cn("bg-transparent")}
      data-loading={loading || undefined}
    >
      <Row
        className={cn(
          "group block w-full bg-transparent px-1 py-3 text-left text-inherit no-underline",
          clickable && "cursor-pointer focus-visible:bg-surface-subtle",
          frame && "px-[var(--public-gutter)]",
        )}
        href={clickable ? source : undefined}
        rel={clickable ? "noreferrer" : undefined}
        target={clickable ? "_blank" : undefined}
      >
        <span className="grid gap-[.36rem]">
          <span className="flex flex-wrap items-center gap-[7px]">
            {!dataset ? (
              <Badge loading={loading}>
                {item?.paper?.year ?? (loading ? "0000" : "Undated")}
              </Badge>
            ) : null}
            {!loading && item?.openAlexWorkId ? <Badge>OpenAlex</Badge> : null}
            {loading || category ? (
              <Badge loading={loading}>{category ?? "publication"}</Badge>
            ) : null}
            {!loading && item?.paper?.venue ? (
              <Badge>{item.paper.venue}</Badge>
            ) : null}
            {dataset && item?.dataset?.license ? (
              <Badge>{item.dataset.license}</Badge>
            ) : null}
            {dataset && item?.dataset?.version ? (
              <Badge>{item.dataset.version}</Badge>
            ) : null}
          </span>
          <strong
            className={cn(
              "flex items-start gap-1 font-sans text-base leading-[1.35] font-medium tracking-[-.01em] transition-colors duration-[140ms]",
              clickable &&
                "group-hover:text-brand group-focus-visible:text-brand",
              loading && loadingPlaceholder(true, "text", "long"),
            )}
            data-placeholder={loading ? "text" : undefined}
            data-placeholder-width="long"
          >
            <span>{title}</span>
            {clickable ? (
              <ArrowUpRight
                aria-hidden="true"
                className="mt-[.15rem] shrink-0"
                size={14}
              />
            ) : null}
          </strong>
          {loading || authors ? (
            <span
              className={cn(
                "text-[.72rem] leading-[1.5] text-ink-muted",
                loading && loadingPlaceholder(true, "text", "medium"),
              )}
              data-placeholder={loading ? "text" : undefined}
              data-placeholder-width="medium"
            >
              {authors}
            </span>
          ) : null}
          {!loading && item?.summary ? (
            <span className="text-[.72rem] leading-[1.5] text-ink-muted">
              {item.summary}
            </span>
          ) : null}
          <span
            className={cn(
              "font-mono text-[.55rem] text-ink-muted [overflow-wrap:anywhere]",
              loading && loadingPlaceholder(true, "text", "medium"),
            )}
            data-placeholder={loading ? "text" : undefined}
            data-placeholder-width="medium"
          >
            {loading
              ? "doi.org/00.0000/example"
              : doi
                ? `doi.org/${doi}`
                : "DOI not available"}
          </span>
        </span>
      </Row>
    </FramedRow>
  );
}

function normalizeDoi(doi: string | null | undefined): string | null {
  const value = doi?.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  return value || null;
}

function authorsFromCitation(
  citation: string | null | undefined,
  title: string,
): string {
  if (!citation) return "";
  const cleanTitle = title.replace(/[.,;:]$/, "");
  const index = citation
    .toLocaleLowerCase()
    .indexOf(cleanTitle.toLocaleLowerCase());
  if (index <= 0) return "";
  return citation
    .slice(0, index)
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/\s*\(?\d{4}\)?\s*$/, "")
    .replace(/[\s,:;“”"'‘’—-]+$/, "")
    .trim();
}
