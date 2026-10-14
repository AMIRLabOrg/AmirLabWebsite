"use client";

import { CornerDownLeft, Search, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";
import { InputControl } from "./form-controls";

import { SEARCH_DEBOUNCE_MS } from "@/lib/search-policy";

export function ToolbarSearchField({
  id,
  label,
  loading = false,
  onValueChange,
  onSearch,
  placeholder,
  value,
}: {
  id: string;
  label: string;
  loading?: boolean;
  onValueChange: (value: string) => void;
  onSearch: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<number | undefined>(undefined);
  const search = useRef(onSearch);
  useEffect(() => {
    search.current = onSearch;
  }, [onSearch]);
  useEffect(() => () => window.clearTimeout(debounceTimer.current), []);
  return (
    <div className="grid min-w-0 content-start gap-1.5">
      <label
        aria-hidden={loading || undefined}
        className={cn(
          "font-sans text-[11px] leading-[1.4] font-medium text-ink-muted",
          loading && loadingPlaceholder(true, "label", "short"),
        )}
        htmlFor={id}
      >
        {label}
      </label>
      <div className="relative grid items-center">
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute left-3 z-[1] text-ink-muted",
            loading && "opacity-0",
          )}
          size={17}
        />
        <InputControl
          className="pl-10 pr-20 [&::-webkit-search-cancel-button]:appearance-none"
          ref={input}
          id={id}
          loading={loading}
          disabled={loading}
          onChange={(event) => {
            const next = event.target.value;
            onValueChange(next);
            window.clearTimeout(debounceTimer.current);
            if (SEARCH_DEBOUNCE_MS !== null) {
              debounceTimer.current = window.setTimeout(
                () => search.current(next),
                SEARCH_DEBOUNCE_MS,
              );
            }
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
            event.preventDefault();
            window.clearTimeout(debounceTimer.current);
            onSearch(value);
          }}
          placeholder={loading ? "" : placeholder}
          type="search"
          enterKeyHint="search"
          aria-description="Press Enter to search"
          value={value}
        />
        {value && !loading ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            className="absolute right-8 flex h-8 w-8 items-center justify-center rounded-control text-ink-muted hover:bg-brand-soft hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
            onClick={() => {
              onValueChange("");
              window.clearTimeout(debounceTimer.current);
              onSearch("");
              input.current?.focus();
            }}
          >
            <X aria-hidden="true" size={16} />
          </button>
        ) : null}
        {!loading ? (
          <CornerDownLeft
            aria-hidden="true"
            size={15}
            className="pointer-events-none absolute right-3 text-ink-muted"
          />
        ) : null}
      </div>
    </div>
  );
}
