import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PublicShell({ as: Component = "div", className, children, ...props }: { as?: ElementType; className?: string; children: ReactNode } & Omit<ComponentPropsWithoutRef<"div">, "children">) {
  return (
    <Component className={cn("mx-auto w-full max-w-[var(--public-wide)] px-[clamp(1rem,3.2vw,3rem)] max-[640px]:px-4", className)} {...props}>
      {children}
    </Component>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mb-[.65rem] font-mono text-[.66rem] font-semibold tracking-[.105em] text-brand uppercase", className)}>{children}</p>;
}
