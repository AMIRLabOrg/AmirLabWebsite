"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export function TabsControl({ ariaLabel, className, onValueChange, options, value }: { ariaLabel: string; className?: string; onValueChange: (value: string) => void; options: Array<{ count?: number; label: string; value: string }>; value: string; }) {
  return (
    <Tabs.Root className={cn("min-w-0", className)} onValueChange={onValueChange} value={value}>
      <Tabs.List aria-label={ariaLabel} className="flex min-w-max gap-0">
        {options.map((option) => (
          <Tabs.Trigger
            className="inline-flex min-h-[43px] cursor-pointer items-center gap-[.45rem] border-0 border-b-2 border-b-transparent bg-transparent px-[.85rem] py-[.65rem] text-[.76rem] font-bold text-ink-muted transition-colors duration-150 hover:text-ink data-[state=active]:border-b-brand data-[state=active]:text-brand focus-visible:shadow-none motion-reduce:transition-none"
            key={option.value}
            value={option.value}
          >
            {option.label}
            {option.count === undefined ? null : <span className="font-mono text-[.6rem] text-ink-muted">{option.count}</span>}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
    </Tabs.Root>
  );
}
