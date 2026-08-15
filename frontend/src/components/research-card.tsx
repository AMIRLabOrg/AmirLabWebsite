import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { ResearchItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function ResearchCard({ item, loading = false, variant = "card" }: { item?: ResearchItem; loading?: boolean; variant?: "card" | "index" }) {
  const meta = item?.paper?.venue ?? item?.dataset?.license ?? item?.project?.status?.replaceAll("_", " ") ?? (loading ? "Record metadata" : "Verified output");
  const typeLabel = item?.type?.toLowerCase() ?? "record";
  const title = item?.title ?? item?.paper?.citation ?? (loading ? "Research record title" : "Untitled research item");
  const summary = item?.summary ?? (loading ? "Research summary and evidence context are loading for this indexed record." : "Open the source record for complete details.");
  const href = item?.type === "PROJECT" && item.project?.publicPageEnabled !== false ? `/projects/${item.slug}` : item?.canonicalUrl ?? item?.legacyUrl ?? undefined;
  const external = item?.type !== "PROJECT";
  const index = variant === "index";

  return (
    <article aria-busy={loading || undefined} className={cn(index ? "grid min-h-0 grid-cols-[95px_minmax(0,1fr)_150px] gap-[.4rem] border-b border-line bg-transparent px-[.2rem] py-4 max-[640px]:grid-cols-[70px_minmax(0,1fr)]" : "flex min-h-[250px] flex-col")} data-loading={loading || undefined}>
      <div className={index ? "self-start justify-self-start" : undefined}><Badge loading={loading}>{typeLabel}</Badge></div>
      <h3 className={cn("font-serif", index && "col-start-2 row-start-1 m-0 text-[1.12rem] font-medium", loading && loadingPlaceholder(true, "text", "long"))} data-placeholder={loading ? "text" : undefined} data-placeholder-width="long">{title}</h3>
      <p className={cn(index && "col-start-2 mt-[.15rem] mb-0 text-[.72rem] leading-[1.55] text-ink-muted", loading && loadingPlaceholder(true, "text"))} data-placeholder={loading ? "text" : undefined}>{summary}</p>
      <span className={cn(index ? "col-start-3 row-start-1 text-right font-mono text-[.56rem] text-ink-muted max-[640px]:col-start-2 max-[640px]:row-auto max-[640px]:text-left" : "text-[.82rem] text-ink-muted", loading && loadingPlaceholder(true, "text", "short"))} data-placeholder={loading ? "text" : undefined} data-placeholder-width="short">{meta}</span>
      {loading ? (
        <Link aria-disabled className={cn("inline-flex items-center gap-[.4rem] font-bold text-brand", index ? "col-start-3 row-start-2 self-end justify-self-end text-[.66rem] max-[640px]:col-start-2 max-[640px]:row-auto max-[640px]:justify-self-start" : "mt-auto pt-6 text-[.88rem]")} href="#" tabIndex={-1}>Open record <ExternalLink aria-hidden="true" className="opacity-10" size={15} /></Link>
      ) : href && item?.type === "PROJECT" ? (
        <Link className={cn("inline-flex items-center gap-[.4rem] font-bold text-brand", index ? "col-start-3 row-start-2 self-end justify-self-end text-[.66rem] max-[640px]:col-start-2 max-[640px]:row-auto max-[640px]:justify-self-start" : "mt-auto pt-6 text-[.88rem]")} href={href}>View progress <ExternalLink aria-hidden="true" size={15} /></Link>
      ) : href ? (
        <a className={cn("inline-flex items-center gap-[.4rem] font-bold text-brand", index ? "col-start-3 row-start-2 self-end justify-self-end text-[.66rem] max-[640px]:col-start-2 max-[640px]:row-auto max-[640px]:justify-self-start" : "mt-auto pt-6 text-[.88rem]")} href={href} rel="noreferrer" target={external ? "_blank" : undefined}>Open source <ExternalLink aria-hidden="true" size={15} /></a>
      ) : null}
    </article>
  );
}
