"use client";

import Image from "next/image";
import { API_URL } from "@/lib/api";
import type { University } from "@/lib/types";

function UniversityLogo({
  name,
  logoAssetId,
}: {
  name: string;
  logoAssetId: string | null;
}) {
  if (logoAssetId) {
    return (
      <Image
        alt={name}
        className="h-auto max-h-20 w-auto max-w-[280px] opacity-65 grayscale-[.35] transition-[filter,opacity] duration-[350ms] group-hover:opacity-100 group-hover:grayscale-0"
        height={80}
        src={`${API_URL}/assets/${logoAssetId}`}
        unoptimized
        width={280}
      />
    );
  }
  return (
    <span className="px-4 text-center font-serif text-[1.4rem] font-medium leading-[1.2] opacity-65 transition-opacity duration-[350ms] group-hover:opacity-100 border-l-2 border-r-2">
      {name}
    </span>
  );
}

const ITEM_WIDTH = 320;
const MIN_TRACK_PX = 4000;

export function UniversitiesMarquee({
  universities,
}: {
  universities: University[];
}) {
  if (!universities.length) return null;

  const copiesNeeded = Math.ceil(
    MIN_TRACK_PX / (universities.length * ITEM_WIDTH),
  );
  const repetitions = Math.max(
    2,
    copiesNeeded % 2 === 0 ? copiesNeeded : copiesNeeded + 1,
  );
  const items = Array.from({ length: repetitions }, () => universities).flat();

  return (
    <div className="group/marquee relative w-full overflow-hidden">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-[100px] bg-[linear-gradient(to_right,var(--canvas),transparent)]"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-[100px] bg-[linear-gradient(to_left,var(--canvas),transparent)]"
      />
      <div className="flex w-max gap-[clamp(4rem,8vw,7rem)] will-change-transform animate-[marquee-scroll_40s_linear_infinite] group-hover/marquee:[animation-play-state:paused] motion-reduce:animate-none">
        {items.map((university, index) => (
          <div
            className="group flex h-20 shrink-0 items-center justify-center"
            key={`${university.id}-${index}`}
          >
            {university.websiteUrl ? (
              <a
                className="flex h-full items-center justify-center text-inherit no-underline"
                href={university.websiteUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <UniversityLogo
                  logoAssetId={university.logoAssetId}
                  name={university.name}
                />
              </a>
            ) : (
              <UniversityLogo
                logoAssetId={university.logoAssetId}
                name={university.name}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
