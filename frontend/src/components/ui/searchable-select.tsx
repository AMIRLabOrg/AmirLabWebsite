"use client";

import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

export interface SearchableSelectOption {
  label: string;
  value: string;
  description?: string;
}

export function SearchableSelect({
  ariaLabel,
  disabled,
  emptyMessage = "No matches found.",
  filterOptions = true,
  loading,
  loadingMessage = "Searching…",
  onQueryChange,
  onValueChange,
  options,
  placeholder = "Select…",
  placeholderLoading = false,
  searchPlaceholder = "Search…",
  value,
}: {
  ariaLabel?: string;
  disabled?: boolean;
  emptyMessage?: string;
  filterOptions?: boolean;
  loading?: boolean;
  loadingMessage?: string;
  onQueryChange?: (query: string) => void;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  placeholderLoading?: boolean;
  searchPlaceholder?: string;
  value?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    if (!filterOptions) return options;
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) =>
      `${option.label} ${option.description ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [filterOptions, options, query]);
  const resolvedActiveIndex = Math.min(
    activeIndex,
    Math.max(filtered.length - 1, 0),
  );

  useEffect(() => {
    if (!open || !filtered.length) return;
    document
      .getElementById(`${listId}-option-${resolvedActiveIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [filtered.length, listId, open, resolvedActiveIndex]);

  function select(option: SearchableSelectOption) {
    onValueChange(option.value);
    setOpen(false);
  }

  return (
    <Popover.Root
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
          return;
        }
        const selectedIndex = options.findIndex(
          (option) => option.value === value,
        );
        setActiveIndex(Math.max(selectedIndex, 0));
      }}
      open={open}
    >
      <Popover.Trigger
        aria-label={ariaLabel}
        className={cn(
          "inline-flex h-[var(--control-height)] min-h-[var(--control-height)] w-full min-w-[170px] cursor-pointer items-center justify-between gap-3 rounded-control border border-line bg-surface px-4 py-0 text-left text-[.9rem] font-normal text-ink transition-[border-color,box-shadow,background] duration-150 hover:border-[color-mix(in_srgb,var(--brand)_42%,var(--line))] data-[state=open]:border-brand focus-visible:border-brand focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-faint motion-reduce:transition-none",
          placeholderLoading && loadingPlaceholder(true, "control"),
        )}
        data-placeholder={placeholderLoading ? "control" : undefined}
        disabled={disabled || placeholderLoading}
        type="button"
      >
        <span
          className={cn(
            "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap",
            placeholderLoading && loadingPlaceholder(true, "text", "medium"),
          )}
          data-placeholder={placeholderLoading ? "text" : undefined}
          data-placeholder-width="medium"
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown aria-hidden="true" size={15} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          className="z-[100] w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-[calc(3px+.35rem)] border border-line bg-surface p-[.35rem] shadow-[0_18px_50px_color-mix(in_srgb,var(--brand-hover)_16%,transparent)] animate-[popover-enter_160ms_ease-out] motion-reduce:animate-none"
          sideOffset={6}
        >
          <div className="mb-[.35rem] grid grid-cols-[20px_minmax(0,1fr)] items-center rounded-[3px] border border-line px-[.55rem]">
            <Search aria-hidden="true" className="text-ink-muted" size={15} />
            <input
              aria-activedescendant={
                filtered.length
                  ? `${listId}-option-${resolvedActiveIndex}`
                  : undefined
              }
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={open}
              aria-label={searchPlaceholder}
              autoFocus
              className="min-h-[38px] w-full border-0 bg-transparent py-[.45rem] text-ink outline-none"
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
                onQueryChange?.(event.target.value);
              }}
              onKeyDown={(event) => {
                if (
                  !filtered.length &&
                  (event.key === "ArrowDown" ||
                    event.key === "ArrowUp" ||
                    event.key === "Enter")
                )
                  return;
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActiveIndex(
                    Math.min(resolvedActiveIndex + 1, filtered.length - 1),
                  );
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActiveIndex(Math.max(resolvedActiveIndex - 1, 0));
                } else if (
                  event.key === "Enter" &&
                  filtered[resolvedActiveIndex]
                ) {
                  event.preventDefault();
                  select(filtered[resolvedActiveIndex]);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  setOpen(false);
                }
              }}
              placeholder={searchPlaceholder}
              role="combobox"
              value={query}
            />
          </div>
          <div
            className="grid max-h-[min(360px,45vh)] gap-[var(--space-1)] overflow-auto rounded-b-[3px] [scrollbar-color:var(--ink-faint)_transparent] [scrollbar-width:thin]"
            id={listId}
            role="listbox"
          >
            {loading ? (
              <p className="m-0 p-[.8rem] text-[.8rem] text-ink-muted">
                {loadingMessage}
              </p>
            ) : filtered.length ? (
              filtered.map((option, index) => (
                <button
                  aria-selected={option.value === value}
                  className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-[2px] border-0 bg-transparent px-[.65rem] py-[.55rem] text-left text-[.82rem] font-normal text-ink hover:bg-brand-soft hover:text-brand focus-visible:bg-brand-soft focus-visible:text-brand data-[active]:bg-brand-soft data-[active]:text-brand aria-selected:bg-brand-soft aria-selected:font-[650] aria-selected:text-brand"
                  data-active={index === resolvedActiveIndex ? "" : undefined}
                  id={`${listId}-option-${index}`}
                  key={option.value}
                  onClick={() => select(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  role="option"
                  type="button"
                >
                  <span className="grid min-w-0 gap-[.15rem] [overflow-wrap:anywhere]">
                    {option.label}
                    {option.description ? (
                      <small className="text-[.7rem] font-normal text-ink-muted">
                        {option.description}
                      </small>
                    ) : null}
                  </span>
                  {option.value === value ? (
                    <Check aria-hidden="true" size={14} />
                  ) : null}
                </button>
              ))
            ) : (
              <p className="m-0 p-[.8rem] text-[.8rem] text-ink-muted">
                {emptyMessage}
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
