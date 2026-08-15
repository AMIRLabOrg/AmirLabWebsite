"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function PaginationControls({ page = 1, pageSize = 12, total = 0, totalPages = 1, onPageChange = () => undefined, loading = false }: { page?: number; pageSize?: number; total?: number; totalPages?: number; onPageChange?: (page: number) => void; loading?: boolean; }) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const pagerButton = "flex h-9 w-9 cursor-pointer items-center justify-center rounded-control border border-line bg-transparent text-ink-muted transition-colors duration-150 hover:not-disabled:border-brand hover:not-disabled:text-brand disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none";
  return (
    <nav aria-busy={loading || undefined} aria-label="Pagination" className="flex min-w-0 items-center justify-between gap-4 py-2 max-[520px]:flex-col max-[520px]:items-start" data-loading={loading || undefined}>
      <Badge loading={loading}>{loading ? "00-00 of 00" : `${first}-${last} of ${total}`}</Badge>
      <div className="flex items-center gap-[.6rem]">
        <button aria-label="Previous page" className={cn(pagerButton, loading && loadingPlaceholder(true, "control"))} data-placeholder={loading ? "control" : undefined} disabled={loading || page <= 1} onClick={() => onPageChange(page - 1)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>
        <span className={cn("m-0 text-[.78rem] text-ink-muted", loading && loadingPlaceholder(true, "text"))} data-placeholder={loading ? "text" : undefined}>{loading ? "Page 0 of 0" : `Page ${page} of ${Math.max(totalPages, 1)}`}</span>
        <button aria-label="Next page" className={cn(pagerButton, loading && loadingPlaceholder(true, "control"))} data-placeholder={loading ? "control" : undefined} disabled={loading || page >= totalPages} onClick={() => onPageChange(page + 1)} type="button"><ChevronRight aria-hidden="true" size={18} /></button>
      </div>
    </nav>
  );
}
