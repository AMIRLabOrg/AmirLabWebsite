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
          ? "h-[22px] w-[22px] max-[560px]:h-[24px] max-[560px]:w-[24px]"
          : "h-7 w-7 max-[560px]:h-[24px] max-[560px]:w-[24px]",
      )}
      height={compact ? 22 : 28}
      priority
      src="/amirlab-logo.webp"
      width={compact ? 22 : 28}
    />
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-label="AmirLab"
      className={cn(
        "inline-flex min-w-0 items-center gap-[.55rem] max-[560px]:gap-[.35rem]",
        compact && "gap-[.45rem]",
      )}
    >
      <BrandMark compact={compact} />
      <span className="grid min-w-0 gap-[.2rem]">
        <Image
          alt=""
          aria-hidden="true"
          className={cn(
            "h-auto w-[6.25rem] object-contain object-left max-[560px]:w-20",
            compact && "w-[5.6rem]",
          )}
          height={132}
          priority
          src="/amirlab-wordmark.png"
          width={960}
        />
        <small className="whitespace-nowrap font-mono text-[.42rem] leading-[1.2] font-normal tracking-[.065em] text-ink-muted max-[560px]:text-[.30rem]">
          Advanced Machine Intelligence Research Lab
        </small>
      </span>
    </span>
  );
}
