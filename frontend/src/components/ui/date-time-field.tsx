"use client";

import * as Popover from "@radix-ui/react-popover";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { loadingPlaceholder } from "@/lib/loading-style";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const TIME_PRESETS = [
  { label: "9:00 AM", hour: 9, minute: 0 },
  { label: "12:00 PM", hour: 12, minute: 0 },
  { label: "5:00 PM", hour: 17, minute: 0 },
] as const;

interface DateTimeFieldProps {
  disabled?: boolean;
  label: string;
  loading?: boolean;
  maxValue?: string;
  minValue?: string;
  mode?: "date" | "datetime";
  onChange: (value: string) => void;
  showInlineLabel?: boolean;
  value: string;
}

export function DateTimeField({
  disabled = false,
  label,
  loading = false,
  maxValue,
  minValue,
  mode = "datetime",
  onChange,
  showInlineLabel = true,
  value,
}: DateTimeFieldProps) {
  const selected = parseValue(value);
  const minDate = parseValue(minValue ?? "");
  const maxDate = parseValue(maxValue ?? "");
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(selected ?? new Date()),
  );
  const [draft, setDraft] = useState<Date>(() => selected ?? roundHour(new Date()));
  const includesTime = mode === "datetime";
  const triggerLabel = useMemo(
    () => formatValue(value, includesTime),
    [includesTime, value],
  );

  function commit(next: Date) {
    const validNext = clampDate(next, minDate, maxDate);
    setDraft(validNext);
    onChange(includesTime ? toDateTimeValue(validNext) : toDateValue(validNext));
  }

  function openPicker(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) return;
    const nextDraft = selected ?? roundHour(new Date());
    setDraft(nextDraft);
    setVisibleMonth(startOfMonth(nextDraft));
  }

  return (
    <Popover.Root onOpenChange={openPicker} open={open}>
      <Popover.Trigger
        aria-label={label}
        className={cn(
          "grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)] items-center rounded-control border border-line bg-surface px-[.8rem] text-left text-ink transition-[border-color,box-shadow,background] duration-150 hover:border-[color-mix(in_srgb,var(--brand)_42%,var(--line))] data-[state=open]:border-brand focus-visible:border-brand focus-visible:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-faint motion-reduce:transition-none",
          showInlineLabel ? "min-h-[var(--control-height)] py-[.4rem]" : "h-[var(--control-height)] min-h-[var(--control-height)] py-0",
          loadingPlaceholder(loading, "control"),
        )}
        data-placeholder={loading ? "control" : undefined}
        disabled={disabled || loading}
        type="button"
      >
        <CalendarDays aria-hidden="true" className={cn("mr-[.6rem] text-ink-muted", showInlineLabel && "row-span-2")} size={17} />
        {showInlineLabel ? <span className="text-[.68rem] font-bold text-ink-muted">{label}</span> : null}
        <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[.95rem] font-normal leading-[1.45]">{triggerLabel}</strong>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" className="z-[100] grid w-[min(420px,calc(100vw-2rem))] gap-[.9rem] rounded-[4px] border border-line bg-surface p-4 shadow-[0_24px_60px_color-mix(in_srgb,var(--brand-hover)_16%,transparent)]" sideOffset={8}>
          <DatePicker
            onChange={(day) => {
              const next = withDate(draft, day);
              commit(next);
              if (!includesTime) setOpen(false);
            }}
            maxDate={maxDate}
            minDate={minDate}
            onMonthChange={setVisibleMonth}
            selected={draft}
            visibleMonth={visibleMonth}
          />
          {includesTime ? (
            <TimePicker
              maxDate={maxDate}
              minDate={minDate}
              onChange={(hour, minute) => commit(withTime(draft, hour, minute))}
              value={draft}
            />
          ) : null}
          <div className="flex items-center justify-between border-t border-line pt-3">
            <button className="min-h-[34px] cursor-pointer rounded-control border-0 bg-transparent px-[.55rem] py-[.35rem] text-[.78rem] text-brand hover:bg-brand-soft" onClick={() => onChange("")} type="button">
              Clear
            </button>
            <button
              className="min-h-[34px] cursor-pointer rounded-control border-0 bg-transparent px-[.55rem] py-[.35rem] text-[.78rem] text-brand hover:bg-brand-soft"
              onClick={() => {
                commit(roundHour(new Date()));
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

export function DateField({
  disabled,
  label,
  loading,
  maxValue,
  minValue,
  onChange,
  showInlineLabel,
  value,
}: Omit<DateTimeFieldProps, "mode">) {
  return (
    <DateTimeField
      disabled={disabled}
      label={label}
      loading={loading}
      maxValue={maxValue}
      minValue={minValue}
      mode="date"
      onChange={onChange}
      showInlineLabel={showInlineLabel}
      value={value}
    />
  );
}

function DatePicker({
  maxDate,
  minDate,
  onChange,
  onMonthChange,
  selected,
  visibleMonth,
}: {
  maxDate?: Date;
  minDate?: Date;
  onChange: (value: Date) => void;
  onMonthChange: (value: Date | ((current: Date) => Date)) => void;
  selected: Date;
  visibleMonth: Date;
}) {
  return (
    <>
      <div className="flex items-center justify-between">
        <strong className="text-[.9rem]">
          {visibleMonth.toLocaleDateString("en", {
            month: "long",
            year: "numeric",
          })}
        </strong>
        <div className="flex gap-[.35rem]">
          <button
            aria-label="Previous month"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink hover:bg-brand-soft hover:text-brand"
            onClick={() => onMonthChange((current) => addMonths(current, -1))}
            type="button"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <button
            aria-label="Next month"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent text-ink hover:bg-brand-soft hover:text-brand"
            onClick={() => onMonthChange((current) => addMonths(current, 1))}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((weekday, index) => (
          <span className="py-[.35rem] text-center font-mono text-[.62rem] text-ink-muted" key={`${weekday}-${index}`}>{weekday}</span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {monthGrid(visibleMonth).map((day) => {
          const outside = day.getMonth() !== visibleMonth.getMonth();
          const disabled = outside || !isDateSelectable(day, minDate, maxDate);
          return (
            <button
              aria-disabled={disabled}
              aria-pressed={sameDay(day, selected)}
              className={cn("flex h-9 w-9 cursor-pointer items-center justify-center justify-self-center rounded-full border-0 bg-transparent text-[.78rem] text-ink hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:bg-transparent disabled:text-ink-faint disabled:opacity-45 aria-pressed:bg-brand aria-pressed:font-bold aria-pressed:text-on-accent", outside && "text-ink-faint")}
              disabled={disabled}
              key={toDateValue(day)}
              onClick={() => onChange(day)}
              type="button"
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </>
  );
}

function TimePicker({
  maxDate,
  minDate,
  onChange,
  value,
}: {
  maxDate?: Date;
  minDate?: Date;
  onChange: (hour: number, minute: number) => void;
  value: Date;
}) {
  const hour = to12Hour(value.getHours());
  const period = value.getHours() >= 12 ? "PM" : "AM";

  return (
    <div className="grid gap-3 border-t border-line pt-[.85rem]">
      <header className="flex items-center gap-[.45rem]">
        <Clock aria-hidden="true" size={15} />
        <span className="text-[.68rem] font-bold text-ink-muted">Local time</span>
      </header>
      <div className="grid grid-cols-3 gap-[.6rem]">
        <TimeStepper
          label="Hour"
          max={12}
          min={1}
          onChange={(nextHour) =>
            onChange(to24Hour(nextHour, period), value.getMinutes())
          }
          selectable={(nextHour) =>
            isDateTimeSelectable(
              withTime(value, to24Hour(nextHour, period), value.getMinutes()),
              minDate,
              maxDate,
            )
          }
          value={hour}
        />
        <TimeStepper
          label="Minute"
          max={55}
          min={0}
          onChange={(minute) => onChange(value.getHours(), minute)}
          selectable={(minute) =>
            isDateTimeSelectable(
              withTime(value, value.getHours(), minute),
              minDate,
              maxDate,
            )
          }
          step={5}
          value={value.getMinutes()}
        />
        <div className="grid gap-[.35rem]">
          <span className="text-[.62rem] font-bold text-ink-muted">Period</span>
          <div className="grid min-h-[38px] grid-cols-2 overflow-hidden rounded-control border border-line">
            {(["AM", "PM"] as const).map((item) => (
              <button
                aria-pressed={period === item}
                className="cursor-pointer border-0 bg-transparent font-mono text-[.74rem] text-ink-muted aria-pressed:bg-brand aria-pressed:font-bold aria-pressed:text-on-accent disabled:cursor-not-allowed disabled:opacity-45"
                disabled={
                  !isDateTimeSelectable(
                    withTime(value, to24Hour(hour, item), value.getMinutes()),
                    minDate,
                    maxDate,
                  )
                }
                key={item}
                onClick={() => onChange(to24Hour(hour, item), value.getMinutes())}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-[.45rem]">
        {TIME_PRESETS.map((preset) => (
          <button
            className="min-h-8 cursor-pointer rounded-control border border-line bg-canvas px-[.55rem] py-[.35rem] font-mono text-[.72rem] text-ink hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
            disabled={
              !isDateTimeSelectable(
                withTime(value, preset.hour, preset.minute),
                minDate,
                maxDate,
              )
            }
            key={preset.label}
            onClick={() => onChange(preset.hour, preset.minute)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimeStepper({
  label,
  max,
  min,
  onChange,
  selectable,
  step = 1,
  value,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  selectable?: (value: number) => boolean;
  step?: number;
  value: number;
}) {
  function move(delta: number) {
    const next = value + delta;
    const candidate =
      next > max
        ? min
        : next < min
          ? max - ((max - min) % step)
          : Math.min(max, Math.max(min, next));
    if (!selectable || selectable(candidate)) onChange(candidate);
  }

  return (
    <div className="grid gap-[.35rem]">
      <span className="text-[.62rem] font-bold text-ink-muted">{label}</span>
      <div className="grid min-h-[38px] grid-cols-[30px_1fr_30px] items-center overflow-hidden rounded-control border border-line">
        <button
          aria-label={`Decrease ${label.toLowerCase()}`}
          className="h-full cursor-pointer border-0 bg-transparent text-ink-muted hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
          disabled={selectable ? !selectable(stepValue(value, -step, min, max, step)) : false}
          onClick={() => move(-step)}
          type="button"
        >
          -
        </button>
        <strong className="text-center font-mono text-[.78rem]">{String(value).padStart(2, "0")}</strong>
        <button
          aria-label={`Increase ${label.toLowerCase()}`}
          className="h-full cursor-pointer border-0 bg-transparent text-ink-muted hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
          disabled={selectable ? !selectable(stepValue(value, step, min, max, step)) : false}
          onClick={() => move(step)}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}

function parseValue(value: string): Date | undefined {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (!match) return undefined;
  const [, year, month, day, hour = "09", minute = "00"] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
  );
  const dateMatches = toDateValue(date) === `${year}-${month}-${day}`;
  const timeMatches =
    String(date.getHours()).padStart(2, "0") === hour &&
    String(date.getMinutes()).padStart(2, "0") === minute;
  return dateMatches && timeMatches ? date : undefined;
}

function clampDate(value: Date, minDate?: Date, maxDate?: Date): Date {
  if (minDate && value < minDate) return new Date(minDate);
  if (maxDate && value > maxDate) return new Date(maxDate);
  return value;
}

function isDateSelectable(day: Date, minDate?: Date, maxDate?: Date): boolean {
  if (minDate && endOfDay(day) < minDate) return false;
  if (maxDate && startOfDay(day) > maxDate) return false;
  return true;
}

function isDateTimeSelectable(
  value: Date,
  minDate?: Date,
  maxDate?: Date,
): boolean {
  if (minDate && value < minDate) return false;
  if (maxDate && value > maxDate) return false;
  return true;
}

function formatValue(value: string, includesTime: boolean): string {
  const date = parseValue(value);
  if (!date) return includesTime ? "Select date and time" : "Select date";
  const dateLabel = date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  if (!includesTime) return dateLabel;
  return `${dateLabel} at ${to12Hour(date.getHours())}:${String(date.getMinutes()).padStart(2, "0")} ${date.getHours() >= 12 ? "PM" : "AM"}`;
}

function monthGrid(month: Date): Date[] {
  const start = startOfMonth(month);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function toDateValue(value: Date): string {
  return [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
}

function toDateTimeValue(value: Date): string {
  return `${toDateValue(value)} ${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function startOfMonth(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function endOfDay(value: Date): Date {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
    23,
    59,
    59,
    999,
  );
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(value: Date, months: number): Date {
  return new Date(value.getFullYear(), value.getMonth() + months, 1);
}

function sameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function withDate(current: Date, day: Date): Date {
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    current.getHours(),
    current.getMinutes(),
  );
}

function withTime(current: Date, hour: number, minute: number): Date {
  return new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    hour,
    minute,
  );
}

function to12Hour(hour: number): number {
  const value = hour % 12;
  return value || 12;
}

function to24Hour(hour: number, period: "AM" | "PM"): number {
  if (period === "AM") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function stepValue(
  value: number,
  delta: number,
  min: number,
  max: number,
  step: number,
): number {
  const next = value + delta;
  if (next > max) return min;
  if (next < min) return max - ((max - min) % step);
  return Math.min(max, Math.max(min, next));
}

function roundHour(value: Date): Date {
  const next = new Date(value);
  next.setMinutes(0, 0, 0);
  return next;
}
