"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export function ExpandableBiography({ text, loading = false }: { text?: string; loading?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const value = text ?? "Biography, research focus, and institutional context are loading for this profile.";
  const long = !loading && value.length > 520;
  return (
    <div className="mt-8 max-w-[760px] border-l-2 border-brand pl-6" data-loading={loading || undefined}>
      <p className={cn("m-0 whitespace-pre-line text-[1.02rem] leading-[1.7] text-ink-muted", long && !expanded && "line-clamp-7", loading && loadingPlaceholder(true, "text"))} data-placeholder={loading ? "text" : undefined}>{value}</p>
      {long ? (
        <button aria-expanded={expanded} className="mt-[.9rem] inline-flex cursor-pointer items-center gap-[.4rem] border-0 bg-transparent p-0 text-[.75rem] font-bold text-brand hover:text-brand-hover" onClick={() => setExpanded((value) => !value)} type="button">
          {expanded ? "Show less" : "Read full biography"}<ChevronDown aria-hidden="true" size={15} />
        </button>
      ) : null}
    </div>
  );
}
