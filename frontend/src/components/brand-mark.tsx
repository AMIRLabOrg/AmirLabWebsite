import Image from "next/image";
import { cn } from "@/lib/cn";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn(
        "shrink-0 rounded-none object-contain",
        compact
          ? "h-6 w-6 max-[560px]:h-[27px] max-[560px]:w-[27px]"
          : "h-8 w-8 max-[560px]:h-[27px] max-[560px]:w-[27px]",
      )}
      height={compact ? 24 : 32}
      priority
      src="/amirlab-logo.webp"
      width={compact ? 24 : 32}
    />
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-label="AmirLab"
      className={cn(
        "inline-flex min-w-0 items-center gap-[.62rem] max-[560px]:gap-[.4rem]",
        compact && "gap-[.5rem]",
      )}
    >
      <BrandMark compact={compact} />
      <span className="grid min-w-0 gap-[.25rem]">
        <Image
          alt=""
          aria-hidden="true"
          className={cn(
            "h-auto w-[7.35rem] object-contain object-left max-[560px]:w-24",
            compact && "w-[6.6rem]",
          )}
          height={132}
          priority
          src="/amirlab-wordmark.png"
          width={960}
        />
        <small
          className="whitespace-nowrap font-mono text-[.5rem] leading-[1.2] font-normal tracking-[.065em] text-ink-muted max-[560px]:text-[.30rem]"
        >
          Advanced Machine Intelligence Research Lab
        </small>
      </span>
    </span>
  );
}
