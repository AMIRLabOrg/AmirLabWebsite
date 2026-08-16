"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

interface DateRangePickerProps {
  from: string;
  onChange: (range: { from: string; to: string }) => void;
  to: string;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export function DateRangePicker({ from, onChange, to }: DateRangePickerProps) {
  const selectedStart = parseIsoDate(from);
  const selectedEnd = parseIsoDate(to);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selectedStart ?? addMonths(new Date(), -1)),
  );
  const [draftStart, setDraftStart] = useState<Date | undefined>(selectedStart);
  const [draftEnd, setDraftEnd] = useState<Date | undefined>(selectedEnd);
  const draftStartRef = useRef<Date | undefined>(selectedStart);
  const draftEndRef = useRef<Date | undefined>(selectedEnd);
  const draggingRef = useRef(false);
  const dragMovedRef = useRef(false);
  const selectingRef = useRef(false);

  const label = useMemo(() => {
    if (from && to) return `${formatShortDate(from)} - ${formatShortDate(to)}`;
    if (from) return `${formatShortDate(from)} - ...`;
    return "Select date range";
  }, [from, to]);

  function commitRange(start: Date, end: Date) {
    const [nextFrom, nextTo] = orderDates(start, end);
    const range = { from: toIsoDate(nextFrom), to: toIsoDate(nextTo) };
    if (range.from !== from || range.to !== to) onChange(range);
  }

  function updateDraft(start: Date | undefined, end: Date | undefined) {
    draftStartRef.current = start;
    draftEndRef.current = end;
    setDraftStart(start);
    setDraftEnd(end);
  }

  function finishDragSelection() {
    draggingRef.current = false;
    if (!dragMovedRef.current) {
      selectingRef.current = Boolean(draftStartRef.current);
      return;
    }
    const start = draftStartRef.current;
    if (start) {
      selectingRef.current = false;
      commitRange(start, draftEndRef.current ?? start);
      setOpen(false);
    }
  }

  function startSelection(day: Date) {
    if (selectingRef.current && draftStartRef.current) {
      selectingRef.current = false;
      commitRange(draftStartRef.current, day);
      setOpen(false);
      return;
    }

    updateDraft(day, undefined);
    draggingRef.current = true;
    dragMovedRef.current = false;
    selectingRef.current = true;
    window.addEventListener("pointerup", finishDragSelection, { once: true });
  }

  function continueSelection(day: Date) {
    const start = draftStartRef.current;
    if ((!draggingRef.current && !selectingRef.current) || !start) return;
    if (draggingRef.current && !sameDay(day, start))
      dragMovedRef.current = true;
    draftEndRef.current = day;
    setDraftEnd(day);
  }

  function chooseDay(day: Date) {
    if (
      !draftStart ||
      (draftStart && draftEnd && sameDay(draftStart, draftEnd))
    ) {
      updateDraft(day, undefined);
      return;
    }
    commitRange(draftStart, day);
    setOpen(false);
  }

  function clearRange() {
    draggingRef.current = false;
    selectingRef.current = false;
    updateDraft(undefined, undefined);
    if (from || to) onChange({ from: "", to: "" });
    setOpen(false);
  }

  return (
    <Popover.Root
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        draggingRef.current = false;
        selectingRef.current = false;
        if (!nextOpen) return;
        updateDraft(selectedStart, selectedEnd);
        if (selectedStart) setVisibleMonth(startOfMonth(selectedStart));
      }}
      open={open}
    >
      <Popover.Trigger
        className="inline-flex h-[var(--control-height)] min-h-[var(--control-height)] w-full min-w-[220px] cursor-pointer items-center justify-center gap-[.55rem] whitespace-nowrap rounded-control border border-line bg-surface px-[.8rem] py-0 text-[.82rem] text-ink transition-[border-color,box-shadow,background] duration-150 hover:border-[color-mix(in_srgb,var(--brand)_42%,var(--line))] data-[state=open]:border-brand focus-visible:border-brand focus-visible:shadow-[var(--focus-ring)] motion-reduce:transition-none"
        type="button"
      >
        <CalendarDays
          aria-hidden="true"
          className="shrink-0 text-ink-muted"
          size={16}
        />
        <span className="min-w-0 overflow-hidden text-ellipsis">{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          className="z-[100] grid w-[min(680px,calc(100vw-2rem))] gap-[.9rem] rounded-[4px] border border-line bg-surface p-4 shadow-[0_24px_60px_color-mix(in_srgb,var(--brand-hover)_16%,transparent)] max-[720px]:w-[min(360px,calc(100vw-2rem))]"
          sideOffset={8}
        >
          <div className="flex items-center justify-end">
            <button
              aria-label="Previous month"
              onClick={() =>
                setVisibleMonth((current) => addMonths(current, -1))
              }
              className="inline-flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-ink hover:bg-brand-soft hover:text-brand"
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={16} />
            </button>
            <button
              aria-label="Next month"
              onClick={() =>
                setVisibleMonth((current) => addMonths(current, 1))
              }
              className="inline-flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-control border-0 bg-transparent text-ink hover:bg-brand-soft hover:text-brand"
              type="button"
            >
              <ChevronRight aria-hidden="true" size={16} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-6 max-[720px]:grid-cols-1">
            {[visibleMonth, addMonths(visibleMonth, 1)].map((month) => (
              <MonthView
                draftEnd={draftEnd}
                draftStart={draftStart}
                key={month.toISOString()}
                month={month}
                onChooseDay={chooseDay}
                onContinueSelection={continueSelection}
                onStartSelection={startSelection}
              />
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-line pt-[.7rem]">
            <button
              className="inline-flex min-h-[34px] cursor-pointer items-center justify-center rounded-control border-0 bg-transparent px-[.65rem] py-[.35rem] text-[.78rem] text-brand hover:bg-brand-soft"
              onClick={clearRange}
              type="button"
            >
              Clear
            </button>
            <button
              className="inline-flex min-h-[34px] cursor-pointer items-center justify-center rounded-control border-0 bg-transparent px-[.65rem] py-[.35rem] text-[.78rem] text-brand hover:bg-brand-soft"
              onClick={() => {
                const today = new Date();
                setVisibleMonth(startOfMonth(today));
                commitRange(today, today);
                setOpen(false);
              }}
              type="button"
            >
              Today
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function MonthView({
  draftEnd,
  draftStart,
  month,
  onChooseDay,
  onContinueSelection,
  onStartSelection,
}: {
  draftEnd?: Date;
  draftStart?: Date;
  month: Date;
  onChooseDay: (day: Date) => void;
  onContinueSelection: (day: Date) => void;
  onStartSelection: (day: Date) => void;
}) {
  const days = monthGrid(month);
  const [rangeStart, rangeEnd] =
    draftStart && draftEnd
      ? orderDates(draftStart, draftEnd)
      : [draftStart, draftEnd];

  return (
    <section className="grid gap-[.8rem]">
      <h3 className="m-0 text-center text-[.9rem] font-semibold">
        {month.toLocaleDateString("en", { month: "long", year: "numeric" })}
      </h3>
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((weekday, index) => (
          <span
            className="py-[.35rem] text-center font-mono text-[.62rem] text-ink-muted"
            key={`${weekday}-${index}`}
          >
            {weekday}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day, index) => {
          const outside = day.getMonth() !== month.getMonth();
          if (outside) {
            return (
              <span
                aria-hidden="true"
                className="relative flex h-[38px] select-none items-center justify-center text-[.78rem]"
                key={toIsoDate(day)}
              />
            );
          }
          const selectedStart = Boolean(rangeStart && sameDay(day, rangeStart));
          const selectedEnd = Boolean(rangeEnd && sameDay(day, rangeEnd));
          const inRange = Boolean(
            rangeStart && rangeEnd && day > rangeStart && day < rangeEnd,
          );
          const hasRange = Boolean(
            rangeStart && rangeEnd && !sameDay(rangeStart, rangeEnd),
          );
          const rowStart = index % 7 === 0;
          const rowEnd = index % 7 === 6;
          const className = cn(
            "relative isolate flex h-[38px] cursor-pointer select-none items-center justify-center border-0 bg-transparent text-[.78rem] text-ink hover:text-brand",
            inRange && "bg-surface-subtle",
            inRange && rowStart && "rounded-l-full",
            inRange && rowEnd && "rounded-r-full",
            (selectedStart || selectedEnd) &&
              "font-semibold text-on-accent hover:text-on-accent",
          );
          return (
            <button
              aria-pressed={selectedStart || selectedEnd || inRange}
              className={className}
              key={toIsoDate(day)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                onChooseDay(day);
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                onStartSelection(day);
              }}
              onPointerEnter={() => onContinueSelection(day)}
              type="button"
            >
              {hasRange && selectedStart && !rowEnd ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-1/2 right-0 -z-20 bg-surface-subtle"
                />
              ) : null}
              {hasRange && selectedEnd && !rowStart ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 right-1/2 -z-20 bg-surface-subtle"
                />
              ) : null}
              {selectedStart || selectedEnd ? (
                <span
                  aria-hidden="true"
                  className="absolute left-1/2 top-1/2 -z-10 h-[38px] w-[38px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
                />
              ) : null}
              <span className="relative">{day.getDate()}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function monthGrid(month: Date): Date[] {
  const start = startOfMonth(month);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function parseIsoDate(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return toIsoDate(date) === value ? date : undefined;
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function addDays(value: Date, days: number): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate() + days,
  );
}

function orderDates(left: Date, right: Date): [Date, Date] {
  return left <= right ? [left, right] : [right, left];
}

function sameDay(left: Date, right: Date): boolean {
  return toIsoDate(left) === toIsoDate(right);
}
