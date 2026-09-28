import type { ReactNode } from "react";
import { FrameNodes } from "@/components/ui/public-shell";

export function AuthPageFrame({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="grid min-h-svh content-center px-[var(--public-gutter)] py-10">
      <div className="relative mx-auto w-full max-w-[var(--public-wide)]">
        <div className="relative border-y border-line-strong">
          <FrameNodes />
          <div className="mx-auto grid w-full max-w-[520px] gap-0 py-[clamp(2rem,6vh,3.5rem)] max-[560px]:px-4">
            {children}
          </div>
        </div>
      </div>
    </section>
  );
}

export function AuthPageHeading({
  description,
  eyebrow,
  title,
}: {
  description?: ReactNode;
  eyebrow: ReactNode;
  title: ReactNode;
}) {
  return (
    <header className="mb-1">
      <p className="mb-[.8rem] flex items-center gap-[.55rem] font-mono text-[.6rem] font-semibold uppercase tracking-[.09em] text-brand before:h-px before:w-[30px] before:bg-brand">
        {eyebrow}
      </p>
      <h1 className="m-0 font-serif text-[clamp(2.6rem,5.5vw,4.4rem)] font-medium leading-[.94] tracking-[-.05em]">
        {title}
      </h1>
      {description ? (
        <p className="mt-[.9rem] max-w-[470px] text-[.82rem] leading-[1.6] text-ink-muted">
          {description}
        </p>
      ) : null}
    </header>
  );
}
